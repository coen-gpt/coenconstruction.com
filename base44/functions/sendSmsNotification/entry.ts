import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { to, body } = await req.json();

    if (!to || !body) {
      return Response.json({ error: 'to and body are required' }, { status: 400 });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    // Validate phone number format (basic check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to.replace(/[\s\-\(\)]/g, ''))) {
      return Response.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append('From', fromNumber);
    formData.append('To', to);
    formData.append('Body', body);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      return Response.json({ 
        error: 'Failed to send SMS', 
        details: errorData.message 
      }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ 
      success: true, 
      messageSid: data.sid,
      status: data.status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});