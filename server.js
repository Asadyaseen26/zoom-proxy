const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app = express();

// ── CORS - explicitly allow all origins including oracleapex.com ──
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors());

app.use(express.json());

// ── Health check ──────────────────────────────────────
app.get('/', function(req, res) {
    res.json({ status: 'Zoom proxy is running!' });
});

// ── Credentials from Railway Environment Variables ────
// Never hardcode secrets in code!
const ACCOUNT_ID    = process.env.ZOOM_ACCOUNT_ID;
const CLIENT_ID     = process.env.ZOOM_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

// ── Get Access Token ──────────────────────────────────
async function getAccessToken() {
    const credentials = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');

    const res = await fetch(
        'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + ACCOUNT_ID,
        {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + credentials,
                'Content-Type':  'application/x-www-form-urlencoded'
            }
        }
    );

    const data = await res.json();

    if (!data.access_token) {
        throw new Error('Token failed: ' + JSON.stringify(data));
    }

    return data.access_token;
}

// ── Create Meeting Endpoint ───────────────────────────
app.post('/create-meeting', async (req, res) => {
    try {
        const {
            topic,
            start_time,
            duration,
            doctor_name,
            patient_name,
            timezone
        } = req.body;

        // Validate required fields
        if (!doctor_name || !patient_name || !start_time) {
            return res.status(400).json({
                error: 'Missing required fields: doctor_name, patient_name, start_time'
            });
        }

        const token = await getAccessToken();

        const meetingBody = {
            topic:      topic || ('Consultation: Dr.' + doctor_name),
            type:       2,
            start_time: start_time,
            duration:   duration   || 30,
            timezone:   timezone   || 'Asia/Karachi',
            agenda:     'Doctor: Dr.' + doctor_name + ' | Patient: ' + patient_name,
            settings: {
                host_video:             true,
                participant_video:       true,
                join_before_host:        false,
                waiting_room:            true,
                mute_upon_entry:         true,
                approval_type:           2,
                audio:                   'both',
                auto_recording:          'none',
                allow_multiple_devices:  true
            }
        };

        const zoomRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify(meetingBody)
        });

        const meeting = await zoomRes.json();

        if (!meeting.id) {
            return res.status(400).json({
                error: 'Zoom API error',
                detail: meeting
            });
        }

        // Return only what APEX needs
        res.json({
            meeting_id: meeting.id,
            start_url:  meeting.start_url,   // Doctor - Host link
            join_url:   meeting.join_url,    // Patient - Attendee link
            password:   meeting.password || ''
        });

    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Zoom proxy running on port ' + PORT));
