# Subcontractor Scheduling System

Automated milestone assignment and status tracking for subcontractors via email/SMS with self-service portal.

## Features

### For Project Managers
- **Assign Milestones**: Assign specific workflow milestones to subcontractors
- **Dual Notification**: Send assignments via email or Twilio SMS
- **Custom Messages**: Include special instructions or details
- **Real-time Tracking**: Monitor assignment status (Pending → In Progress → Complete)
- **Auto-updates**: Subcontractor status changes automatically update project timeline

### For Subcontractors
- **Simplified Portal**: No login required - secure token-based access
- **One-Click Updates**: Mark tasks as "In Progress" or "Complete"
- **Mobile-Friendly**: Works on any device via email or SMS link
- **Add Notes**: Include completion notes or photos (future)
- **30-Day Access**: Secure links expire after 30 days

## Technical Implementation

### Entity Schema
Added to `ContractorProject` entity:
```json
{
  "subcontractor_assignments": {
    "type": "array",
    "items": {
      "id": "string",
      "milestone_id": "string",
      "subcontractor_email": "string",
      "subcontractor_phone": "string",
      "subcontractor_name": "string",
      "token": "string (secure access token)",
      "token_expires": "ISO datetime",
      "assigned_at": "ISO datetime",
      "assigned_by": "string (PM email)",
      "status": "pending | in_progress | complete",
      "started_at": "ISO datetime",
      "completed_at": "ISO datetime",
      "notes": "string"
    }
  }
}
```

### Backend Functions

**1. sendSubcontractorAssignment**
- Sends email notification via Resend
- Generates secure token
- Creates assignment record
- Includes branded HTML email with portal link

**2. sendSubcontractorSmsAssignment**
- Sends SMS via Twilio
- Generates secure token
- Creates assignment record
- Short URL for mobile convenience

**3. getSubcontractorPortal**
- Token-based authentication (no login)
- Fetches project and milestone data
- Validates token expiry
- Returns assignment status

**4. updateSubcontractorStatus**
- Updates assignment status
- Updates workflow milestone in project
- Sends SMS notification to PM
- Saves completion notes

### Frontend Components

**SubcontractorScheduler** (`components/estimator/SubcontractorScheduler.jsx`):
- Assignment dialog with email/SMS toggle
- Milestone selection dropdown
- Contact info input
- Assignment list with status badges
- Real-time status updates

**SubcontractorPortal** (`pages/SubcontractorPortal.jsx`):
- Token-based access (no auth required)
- Project and milestone details
- Status display with timeline
- Action buttons (Start/Complete)
- Notes textarea
- Mobile-responsive design

## Usage Guide

### Assigning Tasks to Subcontractors

1. **Navigate to Project**:
   - Go to Estimator → Projects → [Project]
   - Click on "Workflow" tab

2. **Open Assignment Dialog**:
   - Scroll to "Subcontractor Assignments" section
   - Click "Assign Task" button

3. **Select Milestone**:
   - Choose from available (unassigned) milestones
   - Only unassigned milestones shown
   - Milestone list from project workflow

4. **Choose Notification Method**:
   - **Email**: Professional HTML email with full details
   - **SMS**: Quick text with portal link

5. **Enter Contact Info**:
   - Email: `sub@company.com`
   - SMS: `+17819995400` (E.164 format)

6. **Add Message (Optional)**:
   - Special instructions
   - Access codes
   - Timing notes
   - Contact info

7. **Send Assignment**:
   - Click "Send Assignment"
   - Assignment saved to project
   - Notification sent immediately
   - Success toast confirms delivery

### Subcontractor Experience

1. **Receive Notification**:
   - Email: Branded HTML with task details
   - SMS: Short text with link

2. **Access Portal**:
   - Click link in notification
   - No login or password required
   - Token validates automatically

3. **View Task Details**:
   - Task name (milestone label)
   - Project location
   - Due date (if set)
   - Current status

4. **Update Status**:
   - **Not Started** → Click "Mark as In Progress"
   - **In Progress** → Add notes, click "Mark as Complete"
   - **Complete** → View confirmation

5. **Add Notes (Optional)**:
   - Work completed details
   - Issues encountered
   - Follow-up needed
   - Materials used

### Project Manager Notifications

**When Sub Starts Work**:
- SMS to PM: "🔨 [Task] started by subcontractor"
- Project: [Client Name]

**When Sub Completes Work**:
- SMS to PM: "✅ [Task] marked complete by subcontractor"
- Project: [Client Name]
- Milestone automatically marked done in workflow

## Best Practices

### Assignment Strategy
- **One Task Per Sub**: Assign specific milestones to individual subs
- **Clear Descriptions**: Use descriptive milestone names
- **Set Due Dates**: Add due dates to milestones before assigning
- **Timing**: Assign 1-2 weeks before work needed
- **Follow-up**: Use status dashboard to track progress

### Message Templates

**Email Examples**:
```
Please complete rough plumbing installation. 
Access code: 1234. Call PM with questions: (781) 999-5400
```

```
Electrical rough-in for kitchen addition. 
Panel located in garage. Permit posted on fridge.
```

**SMS Examples**:
```
Framing start date: 5/15. 
Lumber delivered 5/14. 
Questions? Call (781) 999-5400
```

### Status Management
- **Daily Checks**: Review assignment status each morning
- **Follow-up**: Call subs with "pending" status approaching due date
- **Escalation**: Reassign if sub unresponsive for 48+ hours
- **Documentation**: Encourage subs to add completion notes

### Token Security
- **30-Day Expiry**: Tokens expire after 30 days
- **Single Use**: One token per assignment
- **Project-Specific**: Token only works for assigned project
- **Regenerate**: Create new assignment if token expires

## Integration Points

### Email (Resend)
- **Template**: Branded HTML email
- **From**: Company name (configured in CompanyProfile)
- **Reply-to**: PM email (future enhancement)
- **Tracking**: Email open tracking (future)

### SMS (Twilio)
- **From**: Company Twilio number
- **To**: Subcontractor mobile
- **Length**: ~160 characters (single SMS)
- **Cost**: ~$0.0075 per SMS (US)

### Workflow Automation
- **Auto-update**: Milestone status syncs with assignment
- **PM Notification**: SMS when sub updates status
- **Timeline Impact**: Completed milestones update project % complete

## Troubleshooting

### Subcontractor Issues

**Link Not Working**:
- Check token expiry (30 days from assignment)
- Verify full URL copied correctly
- Try desktop browser if mobile fails
- Contact PM for new assignment

**Can't Update Status**:
- Ensure token hasn't expired
- Check internet connection
- Clear browser cache
- Try different browser

**Wrong Task Displayed**:
- Clear browser cache
- Close and reopen link
- Contact PM to verify assignment

### Project Manager Issues

**Assignment Not Sending**:
- Check Resend API key (for email)
- Check Twilio credentials (for SMS)
- Verify contact info format
- Check function logs for errors

**Status Not Updating**:
- Sub may have expired token
- Check assignment status in workflow tab
- Refresh project page
- Create new assignment if needed

**Milestone Not Auto-updating**:
- Verify milestone ID matches assignment
- Check function logs for errors
- Manually update milestone if needed
- Reassign milestone to trigger sync

## Cost Considerations

### Email (Resend)
- **Free Tier**: 3,000 emails/month
- **Paid**: $0.20 per 1,000 emails over limit
- **Typical Usage**: 10-20 assignments/month = well within free tier

### SMS (Twilio)
- **Per SMS**: ~$0.0075 (US numbers)
- **Assignment + 2 Notifications**: ~$0.0225 per task
- **Monthly (20 assignments)**: ~$0.45/month
- **International**: Varies by country ($0.05-0.15/SMS)

### Storage
- **Assignment Records**: ~500 bytes each
- **Negligible Cost**: < $0.01/month for typical usage

## Mobile Optimization

### Email
- Responsive HTML design
- Large, tappable buttons
- Single-column layout
- Fast load time

### SMS Portal
- Mobile-first design
- Touch-friendly buttons
- Minimal scrolling
- Fast status updates
- Works offline (caches state)

## Future Enhancements

Potential improvements:
- [ ] Photo upload for completion proof
- [ ] Digital signature on completion
- [ ] Multi-task assignments per sub
- [ ] Recurring task templates
- [ ] Subcontractor directory integration
- [ ] Automated reminders (2 days before due)
- [ ] Calendar sync (Google/Outlook)
- [ ] Subcontractor ratings/reviews
- [ ] Payment trigger on completion
- [ ] Multi-language support (Spanish, etc.)
- [ ] Voice-to-text notes
- [ ] Offline mode for poor signal areas

## Security

### Token System
- **Generation**: Cryptographically random
- **Format**: `sub_{milestoneId}_{timestamp}_{random}`
- **Expiry**: 30 days from creation
- **Validation**: Server-side check on every request

### Access Control
- **No Authentication**: Token serves as authentication
- **Project Isolation**: Token only works for specific project
- **Milestone Isolation**: Can only update assigned milestone
- **Read-only Details**: Can view project info but not modify

### Data Protection
- **HTTPS Only**: All portal traffic encrypted
- **No PII**: Minimal data stored (email/phone only)
- **Auto-cleanup**: Expired assignments can be archived
- **Audit Trail**: All updates logged with timestamps

## Analytics & Reporting

### Metrics to Track
- **Assignment Count**: Total assignments per project/month
- **Completion Rate**: % of assignments completed on time
- **Response Time**: Average time from assign → start
- **Method Effectiveness**: Email vs SMS response rates
- **Subcontractor Performance**: By sub (future)

### Dashboard Ideas
- Pending assignments by due date
- Overdue tasks highlight
- Subcontractor performance cards
- Project timeline impact visualization