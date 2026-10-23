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
} catch { Check "Landing page 200" $false $_.Exception.Message }

try {
    $ev = Invoke-WebRequest -Uri "$base/events" -UseBasicParsing -TimeoutSec 30
    Check "Events page 200" ($ev.StatusCode -eq 200) "status $($ev.StatusCode)"
    Check "Events shows seeded event" ($ev.Content -match "Pitch de minuit") "seeded published event rendered"
} catch { Check "Events page 200" $false $_.Exception.Message }

try {
    $detail = Invoke-WebRequest -Uri "$base/events/seed-event-line-follower" -UseBasicParsing -TimeoutSec 30
    Check "Event page 200" ($detail.StatusCode -eq 200) "status $($detail.StatusCode)"
    Check "Capacity indicator" ($detail.Content -match "spots taken") "capacity widget rendered"
    Check "RSVP pre-login state" ($detail.Content -match "Log in to RSVP") "anonymous sees login CTA"
} catch { Check "Event page 200" $false $_.Exception.Message }

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

# Report
$pass = @($results | Where-Object Pass).Count
$fail = @($results | Where-Object { -not $_.Pass }).Count
$results | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
"TOTAL: $pass passed, $fail failed"
if ($fail -gt 0) { exit 1 }
