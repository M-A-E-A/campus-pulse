# Smoke test for the Campus Pulse core flow, run against http://localhost:3100
# Verifies: public pages, auth, middleware role gates, API authorization.
$ErrorActionPreference = "Stop"
$base = "http://localhost:3100"
$results = @()

function Check($name, $cond, $detail) {
    $script:results += [PSCustomObject]@{ Test = $name; Pass = $cond; Detail = $detail }
}

# 1. Public pages render
try {
    $landing = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 30
    Check "Landing page 200" ($landing.StatusCode -eq 200) "status $($landing.StatusCode)"
    Check "Landing headline" ($landing.Content -match "Every club event") "hero headline present"
    Check "Landing upcoming strip" ($landing.Content -match "Coming up") "upcoming section present"
    # Logged out the bell renders nothing at all — no trigger markup in the nav.
    Check "Bell hidden when logged out" ($landing.Content -notmatch "notif-panel") "no bell trigger in anonymous nav"
} catch { Check "Landing page 200" $false $_.Exception.Message }

try {
    $ev = Invoke-WebRequest -Uri "$base/events" -UseBasicParsing -TimeoutSec 30
    Check "Events page 200" ($ev.StatusCode -eq 200) "status $($ev.StatusCode)"
    Check "Events shows seeded event" ($ev.Content -match "Pitch de minuit") "seeded published event rendered"
    Check "Near me toggle present" ($ev.Content -match "Near me") "location sort control in the rail"
    Check "Campus filter present" ($ev.Content -match "All campuses") "campus select in the rail"
} catch { Check "Events page 200" $false $_.Exception.Message }

try {
    $detail = Invoke-WebRequest -Uri "$base/events/seed-event-line-follower" -UseBasicParsing -TimeoutSec 30
    Check "Event page 200" ($detail.StatusCode -eq 200) "status $($detail.StatusCode)"
    Check "Capacity indicator" ($detail.Content -match "spots taken") "capacity widget rendered"
    Check "RSVP pre-login state" ($detail.Content -match "Log in to RSVP") "anonymous sees login CTA"
    # Share card: the file convention owns og:image (absolute, sized) and the
    # twitter card asks for the full poster instead of a thumbnail.
    Check "Head carries og:image poster" (
        $detail.Content -match 'property="og:image"' -and
        $detail.Content -match "opengraph-image" -and
        $detail.Content -match 'content="summary_large_image"'
    ) "og:image + summary_large_image meta present"
} catch { Check "Event page 200" $false $_.Exception.Message }

# 1b. The og:image route itself: a real PNG, not an error page dressed as one.
try {
    $og = Invoke-WebRequest -Uri "$base/events/seed-event-line-follower/opengraph-image" -UseBasicParsing -TimeoutSec 60
    $ogType = [string]$og.Headers["Content-Type"]
    Check "OG poster route serves PNG" (
        $og.StatusCode -eq 200 -and $ogType -match "image/png" -and $og.RawContentLength -gt 10240
    ) "status $($og.StatusCode), type $ogType, $($og.RawContentLength) bytes"
} catch { Check "OG poster route serves PNG" $false $_.Exception.Message }

# 2. Unauthenticated role gates redirect
foreach ($route in @("/dashboard", "/organizer", "/admin")) {
    try {
        $r = Invoke-WebRequest -Uri "$base$route" -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue
        Check "Anon $route blocked" ($r.StatusCode -in 301,302,303,307,308) "status $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Check "Anon $route blocked" ($code -in 301,302,303,307,308) "status $code"
    }
}

# 3. Anonymous ticket API is 401
try {
    $t = Invoke-WebRequest -Uri "$base/api/events/seed-event-line-follower/ticket" -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue
    Check "Ticket API anon 401" ($t.StatusCode -eq 401) "status $($t.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Ticket API anon 401" ($code -eq 401) "status $code"
}

# 4. Real login as the seeded student via Auth.js credentials flow
$s = $null
try {
    $csrf = Invoke-RestMethod -Uri "$base/api/auth/csrf" -TimeoutSec 30 -SessionVariable s
    $body = @{ csrfToken = $csrf.csrfToken; email = "student@campus.ma"; password = "password123" }
    Invoke-WebRequest -Uri "$base/api/auth/callback/credentials" -Method Post -Body $body -WebSession $s -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue | Out-Null
    $sess = Invoke-RestMethod -Uri "$base/api/auth/session" -WebSession $s -TimeoutSec 30
    Check "Student login" ($sess.user.email -eq "student@campus.ma") "session user: $($sess.user.email)"
    Check "Session carries role" ($sess.user.role -eq "STUDENT") "role: $($sess.user.role)"
} catch { Check "Student login" $false $_.Exception.Message }

# 5. Signed in as student: dashboards allowed, admin blocked by middleware
try {
    $d = Invoke-WebRequest -Uri "$base/dashboard" -WebSession $s -UseBasicParsing -TimeoutSec 30
    Check "Student sees /dashboard" ($d.StatusCode -eq 200) "status $($d.StatusCode)"
    Check "Dashboard shows seeded RSVP" ($d.Content -match "Atelier robotique") "seeded RSVP listed"
    # The trigger renders server-side; the panel only exists after a click.
    Check "Bell renders for signed-in student" ($d.Content -match 'aria-controls="notif-panel"') "bell trigger present in nav"
} catch { Check "Student sees /dashboard" $false $_.Exception.Message }

try {
    $a = Invoke-WebRequest -Uri "$base/admin" -WebSession $s -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue
    Check "Student blocked from /admin" ($a.StatusCode -in 301,302,303,307,308) "status $($a.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Student blocked from /admin" ($code -in 301,302,303,307,308) "status $code"
}

# 5b. Personal ICS feed: dashboard links it, unknown token is refused
Check "Dashboard links ICS feed" ($d.Content -match "/api/calendar/") "feed URL on dashboard"

try {
    $ics = Invoke-WebRequest -Uri "$base/api/calendar/not-a-real-token" -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue
    Check "ICS feed rejects bad token" ($ics.StatusCode -eq 404) "status $($ics.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "ICS feed rejects bad token" ($code -eq 404) "status $code"
}

try {
    $o = Invoke-WebRequest -Uri "$base/organizer" -WebSession $s -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue
    Check "Student blocked from /organizer" ($o.StatusCode -in 301,302,303,307,308) "status $($o.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Student blocked from /organizer" ($code -in 301,302,303,307,308) "status $code"
}

# 6. CSV export refuses a student (server-side authorization)
try {
    $c = Invoke-WebRequest -Uri "$base/api/events/seed-event-line-follower/attendees/csv" -WebSession $s -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue
    Check "CSV blocked for student" ($c.StatusCode -in 401,403) "status $($c.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "CSV blocked for student" ($code -in 401,403) "status $code"
}

# 7. Login as organizer: /organizer allowed, CSV for own club allowed
$so = $null
try {
    $csrf2 = Invoke-RestMethod -Uri "$base/api/auth/csrf" -TimeoutSec 30 -SessionVariable so
    $body2 = @{ csrfToken = $csrf2.csrfToken; email = "organiser@campus.ma"; password = "password123" }
    Invoke-WebRequest -Uri "$base/api/auth/callback/credentials" -Method Post -Body $body2 -WebSession $so -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue | Out-Null
    $sess2 = Invoke-RestMethod -Uri "$base/api/auth/session" -WebSession $so -TimeoutSec 30
    Check "Organizer login" ($sess2.user.role -eq "ORGANIZER") "role: $($sess2.user.role)"

    $od = Invoke-WebRequest -Uri "$base/organizer" -WebSession $so -UseBasicParsing -TimeoutSec 30
    Check "Organizer sees /organizer" ($od.StatusCode -eq 200) "status $($od.StatusCode)"
    Check "Organizer event list" ($od.Content -match "Initiation à la soudure") "draft event listed"

    $csv = Invoke-WebRequest -Uri "$base/api/events/seed-event-line-follower/attendees/csv" -WebSession $so -UseBasicParsing -TimeoutSec 30
    Check "Organizer CSV export" ($csv.StatusCode -eq 200 -and $csv.Content -match "student@campus.ma") "CSV contains attendee"
} catch { Check "Organizer login" $false $_.Exception.Message }

# 8. Login as admin: the queue lists pending events.
#    The seeded draft is staged into the queue first so this passes no matter
#    what state the demo data is in (approving events by hand empties the
#    queue), then it is put back to DRAFT.
$sa = $null
try {
    $csrf3 = Invoke-RestMethod -Uri "$base/api/auth/csrf" -TimeoutSec 30 -SessionVariable sa
    $body3 = @{ csrfToken = $csrf3.csrfToken; email = "admin@campus.ma"; password = "password123" }
    Invoke-WebRequest -Uri "$base/api/auth/callback/credentials" -Method Post -Body $body3 -WebSession $sa -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue | Out-Null

    & node --import tsx scripts/set-event-status.ts seed-event-draft PENDING 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "could not stage the queue fixture" }
    try {
        $ad = Invoke-WebRequest -Uri "$base/admin" -WebSession $sa -UseBasicParsing -TimeoutSec 30
        Check "Admin sees queue" ($ad.Content -match "Initiation à la soudure") "pending event listed in queue"
        Check "Admin queue count" ($ad.Content -match "Waiting for approval") "queue header present"
    } finally {
        & node --import tsx scripts/set-event-status.ts seed-event-draft DRAFT 2>$null | Out-Null
    }
} catch { Check "Admin sees queue" $false $_.Exception.Message }

# 9. Reminder cron: refuses without the secret (401), or without it being
#    configured at all (503 — fails closed, never open).
try {
    Invoke-WebRequest -Uri "$base/api/cron/reminders" -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue | Out-Null
    Check "Cron refuses anonymous" $false "expected a refusal, got 200"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Cron refuses anonymous" ($code -in 401,503) "status $code"
}

# Positive path only runs when the caller exported the same secret as the
# server, so the suite stays environment-agnostic.
if ($env:CRON_SECRET) {
    try {
        $cr = Invoke-WebRequest -Uri "$base/api/cron/reminders" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" } -UseBasicParsing -TimeoutSec 30
        $cj = $cr.Content | ConvertFrom-Json
        Check "Cron accepts valid secret" ($cr.StatusCode -eq 200 -and $cj.ok -eq $true) "status $($cr.StatusCode), ok=$($cj.ok)"
    } catch { Check "Cron accepts valid secret" $false $_.Exception.Message }
}

# 10. PWA: manifest, service worker, offline page, icons, public VAPID key.
#     These are the installability contract — if any of them 404s or ships
#     the wrong shape, the browser simply refuses to offer "install" (or
#     worse, installs an app with no offline page).
try {
    $mf = Invoke-WebRequest -Uri "$base/manifest.webmanifest" -UseBasicParsing -TimeoutSec 30
    # PS 5.1 hands back byte[] for MIME types it doesn't know, and
    # application/manifest+json is one of them — decode before parsing.
    $mfText = if ($mf.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($mf.Content) } else { [string]$mf.Content }
    $mfj = $mfText | ConvertFrom-Json
    $maskable = @($mfj.icons | Where-Object { $_.purpose -eq "maskable" })
    Check "Manifest 200" ($mf.StatusCode -eq 200) "status $($mf.StatusCode)"
    Check "Manifest installable shape" (
        $mfj.display -eq "standalone" -and $mfj.scope -eq "/" -and $mfj.start_url -eq "/" -and
        @($mfj.icons).Count -ge 3 -and $maskable.Count -eq 1 -and $mfj.theme_color -eq "#14130f"
    ) "display=$($mfj.display) scope=$($mfj.scope) icons=$(@($mfj.icons).Count) maskable=$($maskable.Count)"
} catch { Check "Manifest 200" $false $_.Exception.Message }

try {
    $sw = Invoke-WebRequest -Uri "$base/sw.js" -UseBasicParsing -TimeoutSec 30
    Check "Service worker 200" ($sw.StatusCode -eq 200) "status $($sw.StatusCode)"
    Check "SW has push, offline and api guard" (
        $sw.Content -match "showNotification" -and
        $sw.Content -match "offline.html" -and
        $sw.Content -match 'startsWith\("/api/"\)'
    ) "push handler + offline precache + /api/ skip"
} catch { Check "Service worker 200" $false $_.Exception.Message }

try {
    $off = Invoke-WebRequest -Uri "$base/offline.html" -UseBasicParsing -TimeoutSec 30
    Check "Offline page 200" ($off.StatusCode -eq 200) "status $($off.StatusCode)"
    Check "Offline page trilingual" (
        $off.Content -match "hors connexion" -and
        $off.Content -match "You're offline" -and
        $off.Content -match "غير متصل"
    ) "fr + en + ar inline, no external assets"
} catch { Check "Offline page 200" $false $_.Exception.Message }

try {
    $pk = Invoke-WebRequest -Uri "$base/api/push/public-key" -UseBasicParsing -TimeoutSec 30
    $pkj = $pk.Content | ConvertFrom-Json
    Check "Push public key served" (
        $pk.StatusCode -eq 200 -and $pkj.ok -eq $true -and $pkj.publicKey.Length -gt 40
    ) "status $($pk.StatusCode), keyLen=$($pkj.publicKey.Length)"
} catch { Check "Push public key served" $false $_.Exception.Message }

foreach ($icon in @("/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icon.png", "/apple-icon.png")) {
    try {
        $ic = Invoke-WebRequest -Uri "$base$icon" -UseBasicParsing -TimeoutSec 30
        $type = [string]$ic.Headers["Content-Type"]
        Check "Icon $icon" ($ic.StatusCode -eq 200 -and $type -match "image/png") "status $($ic.StatusCode), type $type"
    } catch { Check "Icon $icon" $false $_.Exception.Message }
}

# The vector favicon (endgame "logo pick", A: ink tile + accent stroke):
# same bytes the generator writes, so it can never drift from the PNGs.
try {
    $svgi = Invoke-WebRequest -Uri "$base/icon.svg" -UseBasicParsing -TimeoutSec 30
    $svgType = [string]$svgi.Headers["Content-Type"]
    Check "Icon /icon.svg" ($svgi.StatusCode -eq 200 -and $svgType -match "image/svg\+xml" -and $svgi.Content -match "ff4d00") "status $($svgi.StatusCode), type $svgType, accent present"
} catch { Check "Icon /icon.svg" $false $_.Exception.Message }

# Head wiring: the browser only installs when these tags are actually in the
# served HTML, not just present on disk.
Check "Head links manifest" ($landing.Content -match 'rel="manifest"') "manifest link in <head>"
Check "Head links apple-touch-icon" ($landing.Content -match 'rel="apple-touch-icon"') "iOS icon link in <head>"
Check "Head links SVG favicon" (
    $landing.Content.IndexOf("/icon.svg", [StringComparison]::Ordinal) -ge 0 -and
    $landing.Content.IndexOf("/icon.png", [StringComparison]::Ordinal) -ge 0 -and
    $landing.Content.IndexOf("/icon.svg", [StringComparison]::Ordinal) -lt $landing.Content.IndexOf("/icon.png", [StringComparison]::Ordinal)
) "svg link before png fallback in <head>"
Check "Head carries theme-color" ($landing.Content -match 'name="theme-color"') "theme-color meta in <head>"

# 11. Poster engine: the shareable SVG handbill that leaves the site.
try {
    $p = Invoke-WebRequest -Uri "$base/api/events/seed-event-line-follower/poster" -UseBasicParsing -TimeoutSec 30
    # PS 5.1 may hand back byte[] for image/svg+xml (unknown MIME) — decode.
    $pt = if ($p.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($p.Content) } else { [string]$p.Content }
    Check "Poster SVG 200" ($p.StatusCode -eq 200) "status $($p.StatusCode)"
    Check "Poster is a standalone SVG" (
        [string]$p.Headers["Content-Type"] -match "image/svg\+xml" -and
        $pt -match "<svg" -and $pt -match "</svg>" -and $pt -match "</title>"
    ) "type=$($p.Headers['Content-Type'])"
    Check "Poster embeds the real typeface" ($pt -match "data:font/woff2;base64") "woff2 data URIs, no external fetch"
    Check "Poster carries brand + facts" (
        $pt -match "CAMPUS PULSE" -and $pt -match "campus.ma|localhost" -and $pt -match "#ff4d00"
    ) "wordmark, event URL and accent token present"
} catch { Check "Poster SVG 200" $false $_.Exception.Message }

# PS 5.1's -Headers drops a Cookie header silently (HttpWebRequest treats it
# as a special header) — the cookie must ride a WebSession, same as the
# signed-in sections above. This mirrors what the language switcher sends.
$arSess = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$arSess.Cookies.Add([Uri]$base, (New-Object System.Net.Cookie("cp-locale", "ar", "/", "localhost")))
try {
    $pa = Invoke-WebRequest -Uri "$base/api/events/seed-event-line-follower/poster" -UseBasicParsing -TimeoutSec 30 -WebSession $arSess
    $pat = if ($pa.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($pa.Content) } else { [string]$pa.Content }
    Check "Poster flips to RTL for Arabic" ($pat -match 'direction="rtl"') "direction attr present"
} catch { Check "Poster flips to RTL for Arabic" $false $_.Exception.Message }

# House pattern for expected non-2xx: $ErrorActionPreference=Stop means an
# HTTP error terminates the script even with -ErrorAction SilentlyContinue.
try {
    Invoke-WebRequest -Uri "$base/api/events/seed-event-draft/poster" -UseBasicParsing -TimeoutSec 30 | Out-Null
    Check "Draft events have no poster" $false "expected 404, got 200"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Draft events have no poster" ($code -eq 404) "status $code"
}

try {
    Invoke-WebRequest -Uri "$base/api/events/no-such-event-999/poster" -UseBasicParsing -TimeoutSec 30 | Out-Null
    Check "Unknown event poster 404s" $false "expected 404, got 200"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Unknown event poster 404s" ($code -eq 404) "status $code"
}

# 12. Live pulse: the door counter's SSE stream is organizer-only.
try {
    Invoke-WebRequest -Uri "$base/api/events/seed-event-line-follower/pulse" -UseBasicParsing -TimeoutSec 30 | Out-Null
    Check "Pulse stream refuses anonymous" $false "expected 401, got 200"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Pulse stream refuses anonymous" ($code -eq 401) "status $code"
}

# $s is still the student session from section 6 — a signed-in non-organizer
# must get 403 (the stream is a door display, not a public counter).
try {
    Invoke-WebRequest -Uri "$base/api/events/seed-event-line-follower/pulse" -UseBasicParsing -TimeoutSec 30 -WebSession $s | Out-Null
    Check "Pulse stream refuses a student" $false "expected 403, got 200"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Pulse stream refuses a student" ($code -eq 403) "status $code"
}

# 13. Organizer insights: middleware gate + the analytics surface itself.
try {
    $ii = Invoke-WebRequest -Uri "$base/organizer/insights" -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue
    Check "Anon /organizer/insights blocked" ($ii.StatusCode -in 301,302,303,307,308) "status $($ii.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Anon /organizer/insights blocked" ($code -in 301,302,303,307,308) "status $code"
}

# $s is still the student session — a signed-in non-organizer bounces to
# /dashboard before the page's own club scoping ever runs.
try {
    $iis = Invoke-WebRequest -Uri "$base/organizer/insights" -WebSession $s -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue
    Check "Student blocked from insights" ($iis.StatusCode -in 301,302,303,307,308) "status $($iis.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Student blocked from insights" ($code -in 301,302,303,307,308) "status $code"
}

# $so is the organizer session from section 7 — the page must render with
# both the club-scoped heatmap and the three metric blocks.
try {
    $iio = Invoke-WebRequest -Uri "$base/organizer/insights" -WebSession $so -UseBasicParsing -TimeoutSec 30
    Check "Organizer sees insights" ($iio.StatusCode -eq 200) "status $($iio.StatusCode)"
    Check "Insights heatmap scoped" ($iio.Content -match "by weekday") "shared Insights block rendered"
    Check "Insights metric blocks" ($iio.Content -match "Check-in velocity" -and $iio.Content -match "by week") "registration + velocity + no-show rendered"
} catch { Check "Organizer sees insights" $false $_.Exception.Message }

# 14. Post-event loop: the thank-you band's gates and the recommendations
#     it feeds. Plain GETs take the default locale, so these assertions use
#     the English copy (the CDP probes see the French side).
try {
    $th = Invoke-WebRequest -Uri "$base/events/seed-past-soldering" -WebSession $s -UseBasicParsing -TimeoutSec 30
    Check "Thank-you on ended attended event" ($th.StatusCode -eq 200 -and $th.Content -match "Thanks for coming.") "attended copy rendered"
    Check "Thank-you asks or has answered" ($th.Content -match "Would you attend again|Noted") "question or its answered state"
} catch { Check "Thank-you on ended attended event" $false $_.Exception.Message }

try {
    $ns = Invoke-WebRequest -Uri "$base/events/seed-past-cleanup" -WebSession $s -UseBasicParsing -TimeoutSec 30
    Check "No-show thank-you stays honest" ($ns.Content -match "Thanks for signing up.") "registered copy, never 'thanks for coming'"
} catch { Check "No-show thank-you stays honest" $false $_.Exception.Message }

try {
    $fu = Invoke-WebRequest -Uri "$base/events/seed-event-line-follower" -WebSession $s -UseBasicParsing -TimeoutSec 30
    Check "No band on a live event" ($fu.Content -notmatch 'data-post="thanks"') "band gated by endsAt"
} catch { Check "No band on a live event" $false $_.Exception.Message }

try {
    $an = Invoke-WebRequest -Uri "$base/events/seed-past-soldering" -UseBasicParsing -TimeoutSec 30
    Check "No band for anonymous" ($an.Content -notmatch 'data-post="thanks"') "thank-you requires the signed-in ticket"
} catch { Check "No band for anonymous" $false $_.Exception.Message }

try {
    $rc = Invoke-WebRequest -Uri "$base/dashboard" -WebSession $s -UseBasicParsing -TimeoutSec 30
    Check "Dashboard recommendations section" ($rc.Content -match "Because you liked") "recs section rendered"
    Check "Seeded answer feeds a recommendation" ($rc.Content -match "ETH 2026") "a liked club recommends its next event"
} catch { Check "Dashboard recommendations section" $false $_.Exception.Message }

# 15. Clubs (Phase 12): the directory, a scraped profile, the 404 and the
#     club link-preview PNG. Plain GETs take the default locale (EN copy);
#     the club DATA (names, descriptions) is FR either way.
$clubId = $null
try {
    $cl = Invoke-WebRequest -Uri "$base/clubs" -UseBasicParsing -TimeoutSec 30
    Check "Clubs directory 200" ($cl.StatusCode -eq 200) "status $($cl.StatusCode)"
    Check "Directory lists seeded club" ($cl.Content -match "Club Innovation EMSI") "seeded club rendered"
    Check "Directory search input" ($cl.Content -match 'data-clubsearch') "search hook present"
    Check "Nav links Clubs" ($landing.Content -match 'href="/clubs"') "nav entry in served HTML"
    # Cards carry data-club="<cuid>" — pick Club Innovation's (the follow
    # fixtures below depend on it), not whichever sorts first alphabetically.
    $nameIdx = $cl.Content.IndexOf("Club Innovation EMSI")
    $clubId = ""
    if ($nameIdx -ge 0) {
        $before = $cl.Content.Substring(0, $nameIdx)
        $m = [regex]::Matches($before, 'data-club="([A-Za-z0-9_-]+)"') | Select-Object -Last 1
        if ($m) { $clubId = $m.Groups[1].Value }
    }
    Check "Directory links a profile" ($clubId.Length -gt 10) "scraped club id: $clubId"
} catch { Check "Clubs directory 200" $false $_.Exception.Message }

if ($clubId) {
    try {
        $cp = Invoke-WebRequest -Uri "$base/clubs/$clubId" -UseBasicParsing -TimeoutSec 30
        Check "Club profile 200" ($cp.StatusCode -eq 200) "status $($cp.StatusCode)"
        Check "Profile shows description" ($cp.Content -match "robotique, hackathons") "seeded club body rendered"
        Check "Profile stat boxes" ($cp.Content -match 'data-clubstats') "followers/upcoming/past rendered"
        Check "Profile links upcoming events" ($cp.Content -match 'data-clubevents|data-clubeventsempty') "events section present"
    } catch { Check "Club profile 200" $false $_.Exception.Message }

    try {
        $og = Invoke-WebRequest -Uri "$base/clubs/$clubId/opengraph-image" -UseBasicParsing -TimeoutSec 30
        $ogLen = if ($og.Content -is [byte[]]) { $og.Content.Length } else { ([string]$og.Content).Length }
        Check "Club OG serves PNG" ($og.StatusCode -eq 200 -and [string]$og.Headers["Content-Type"] -match "image/png") "status $($og.StatusCode), type $($og.Headers['Content-Type'])"
        Check "Club OG is a real poster" ($ogLen -gt 10240) "$ogLen bytes"
    } catch { Check "Club OG serves PNG" $false $_.Exception.Message }
}

try {
    Invoke-WebRequest -Uri "$base/clubs/not-a-club-999" -UseBasicParsing -TimeoutSec 30 | Out-Null
    Check "Bogus club id 404s" $false "expected 404, got 200"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Check "Bogus club id 404s" ($code -eq 404) "status $code"
}

# Report
$pass = @($results | Where-Object Pass).Count
$fail = @($results | Where-Object { -not $_.Pass }).Count
$results | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
"TOTAL: $pass passed, $fail failed"
if ($fail -gt 0) { exit 1 }
