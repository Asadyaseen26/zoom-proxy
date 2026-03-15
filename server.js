const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const ACCOUNT_ID = 'lZCTdHz5Sb-hPm6uElKeCg';
const CLIENT_ID = 'EB1e94r_SyWyZCrJ4x8pg';
const CLIENT_SECRET = 'QVnGL2xncGt4RPGyoBsUnMnNRVG29KYI';

async function getAccessToken() {
  const credentials = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
  const res = await fetch(
    'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + ACCOUNT_ID,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + credentials,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  const data = await res.json();
  return data.access_token;
}

app.post('/create-meeting', async (req, res) => {
  try {
    const { topic, start_time, duration, doctor_name, patient_name, timezone } = req.body;
    const token = await getAccessToken();

    const meetingBody = {
      topic:      topic || ('Consultation: Dr.' + doctor_name),
      type:       2,
      start_time: start_time,
      duration:   duration || 30,
      timezone:   timezone || 'Asia/Karachi',
      agenda:     'Patient: ' + patient_name + ' | Doctor: ' + doctor_name,
      settings: {
        host_video:        true,
        participant_video: true,
        join_before_host:  false,
        waiting_room:      true,
        mute_upon_entry:   true,
        approval_type:     2,
        audio:             'both',
        auto_recording:    'none'
      }
    };

    const zoomRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify(meetingBody)
    });

    const meeting = await zoomRes.json();

    if (!meeting.id) {
      return res.status(400).json({ error: 'Zoom API error', detail: meeting });
    }

    res.json({
      meeting_id: meeting.id,
      start_url:  meeting.start_url,
      join_url:   meeting.join_url,
      password:   meeting.password
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Zoom proxy running on port ' + PORT));
