# Twilio SMS Integration

Automated SMS notifications for client project updates and subcontractor communications.

## Features

### Client Notifications (Automated)
- **Project Status Changes**: Automatic SMS when project status changes (e.g., approved → in_progress → completed)
- **Milestone Completions**: SMS sent when workflow milestones are marked complete
- **Personalized Messages**: Includes client name and project-specific details

### Subcontractor Notifications (Manual)
- **Quick Send**: Send SMS directly from vendor directory
- **Project Context**: Include project details when needed
- **Quick Message Templates**: Pre-written common messages for efficiency

## Setup

### 1. Twilio Credentials
Configure in Dashboard → Settings → Secrets:
- `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token  
- `TWILIO_PHONE_NUMBER`: Your Twilio phone number (e.g., +17819995400)

### 2. Client Phone Numbers
Ensure client phone numbers are stored in:
- `ContractorProject.client_phone`, OR
- `CustomerPortal.client_phone`

### 3. Automations
Two automations are configured:
1. **Client SMS - Project Status Change**: Triggers on ContractorProject status updates
2. **Client SMS - Milestone Completed**: Triggers when workflow milestones are marked done

## Usage

### Client SMS (Automatic)
No action needed - SMS sends automatically when:
- Project status changes in the estimator
- A milestone is marked complete in the workflow

### Subcontractor SMS (Manual)
1. Go to Estimator → Vendors
2. Find the subcontractor
3. Click "Send SMS" button
4. Choose a quick message or write custom
5. Send

## Message Templates

### Status Change Messages
- **walkthrough**: "Hi {name}! Your walkthrough is complete..."
- **pending_review**: "Hi {name}! Great news - your estimate is ready..."
- **approved**: "Hi {name}! Your project has been approved! 🎉..."
- **in_progress**: "Hi {name}! Work has begun on your project! 🏗️..."
- **completed**: "Hi {name}! Your project is complete! 🎊..."

### Quick Messages (Subcontractors)
- Bid selection notifications
- Insurance document reminders
- Project start confirmations
- Timeline update requests
- Invoice payment confirmations

## Tracking

View SMS history in:
- **Estimator → Projects → [Project] → Portal tab**
- Shows all sent SMS with timestamps
- Filter by status updates vs milestone completions

## Backend Functions

- `sendSmsNotification`: Core Twilio SMS sender
- `sendProjectStatusSms`: Handles project status change notifications
- `sendMilestoneSms`: Handles milestone completion notifications
- `sendSubcontractorSms`: Manual subcontractor messaging

## Components

- `SubcontractorSmsDialog`: UI for sending SMS to vendors
- `SmsHistoryPanel`: SMS notification history viewer

## Best Practices

1. **Phone Format**: Store numbers in E.164 format (+1XXXXXXXXXX)
2. **Message Length**: Keep under 160 characters to avoid multiple SMS
3. **Timing**: SMS sent during business hours (8am-6pm)
4. **Opt-Out**: Include "Reply STOP to opt-out" for marketing messages
5. **Compliance**: Follow TCPA regulations for commercial SMS

## Troubleshooting

### SMS Not Sending
- Check Twilio credentials in Secrets
- Verify phone number format
- Check Twilio account balance

### Automation Not Triggering
- Verify automation is active (Dashboard → Code → Automations)
- Check function logs for errors
- Ensure client phone number exists

### Invalid Phone Number
- Use format: +17819995400 (no spaces/dashes)
- Include country code (+1 for US)

## Costs

Twilio charges per message:
- **US/Canada**: ~$0.0075/SMS
- **International**: Varies by country
- **Toll-free**: ~$0.003/SMS

Monitor usage in Twilio Console.