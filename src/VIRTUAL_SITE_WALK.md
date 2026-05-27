# 360° Virtual Site Walk Feature

Interactive 360-degree photo viewer with progress markers for construction project documentation.

## Features

### For Project Managers/Estimators
- **Upload 360° Photos**: Upload equirectangular (360°) site photos
- **Add Progress Markers**: Place interactive markers on specific locations in the 360° view
- **Document Milestones**: Mark completed work, key decisions, or areas of interest
- **Virtual Walkthroughs**: Create immersive site documentation without physical visits

### For Clients (Customer Portal)
- **View Progress**: See current site conditions in immersive 360°
- **Interactive Markers**: Click markers to understand what's been completed
- **Timeline Context**: Visual progress tied to project milestones
- **Remote Updates**: Stay connected to the project without site visits

## Technical Implementation

### Entity Schema
Added to `ContractorProject` entity:
```json
{
  "photos_360": {
    "type": "array",
    "items": {
      "id": "string",
      "url": "string (equirectangular image URL)",
      "name": "string",
      "thumbnail_url": "string",
      "uploaded_at": "ISO datetime",
      "markers": [
        {
          "id": "string",
          "pitch": "number (-90 to 90)",
          "yaw": "number (-180 to 180)",
          "note": "string (progress description)",
          "created_at": "ISO datetime"
        }
      ]
    }
  }
}
```

### 360° Viewer Library
Uses **Pannellum** (v2.5.6):
- Lightweight WebGL-based 360° panorama viewer
- Supports equirectangular images
- Hotspot/marker system for annotations
- Touch-friendly for mobile devices
- CDN-loaded (no npm package required)

### Component Structure

**VirtualSiteWalk Component** (`components/estimator/VirtualSiteWalk.jsx`):
- Upload interface for 360° photos
- Grid view of all 360° photos with marker counts
- Full-screen immersive viewer modal
- Marker editing mode (PMs only)
- Progress marker list sidebar

## Usage Guide

### Uploading 360° Photos

1. **Capture 360° Images**:
   - Use 360° camera (Ricoh Theta, Insta360, etc.)
   - Or stitch photos into equirectangular format
   - Recommended resolution: 4000x2000 to 8000x4000 pixels
   - Format: JPG or PNG

2. **Upload to Project**:
   - Go to Estimator → Projects → [Project] → Site Walk tab
   - Click "Upload 360° Photo"
   - Select equirectangular image files
   - Photos appear in grid with thumbnail previews

### Adding Progress Markers

1. **Enter Edit Mode**:
   - Open a 360° photo by clicking "View"
   - Click "Add Markers" button in top right
   - Cursor changes to placement mode

2. **Place Marker**:
   - Click anywhere in the 360° view
   - Dialog appears for marker note
   - Enter progress description (e.g., "Framing complete - North wall")
   - Click "Save Marker"

3. **Marker Visibility**:
   - Markers appear as interactive hotspots in viewer
   - Clients see markers as info points they can click
   - Each marker shows description and date created

4. **Manage Markers**:
   - Edit mode: Delete markers with trash icon
   - Markers list shown below viewer
   - Click "Done Editing" to exit edit mode

### Client Experience

1. **Access Portal**:
   - Client receives portal link via email
   - Navigate to "Site Walk" tab (only visible if 360° photos exist)

2. **View Progress**:
   - Click on any 360° photo thumbnail
   - Drag/scroll to look around the space
   - Click markers (hotspots) to see progress notes
   - Browse marker list below viewer

3. **Navigation**:
   - Mouse drag or touch swipe to pan
   - Scroll or pinch to zoom
   - Compass shows orientation

## Best Practices

### Photo Capture
- **Lighting**: Capture in good, even lighting
- **Timing**: Take photos at consistent times (e.g., every Friday)
- **Coverage**: Capture all rooms/angles for complete documentation
- **Height**: Mount camera at eye level (~5-6 feet)
- **Stability**: Use tripod for sharper images

### Marker Strategy
- **Milestone Markers**: Mark completion of major phases
  - "Framing complete"
  - "Rough-in plumbing installed"
  - "Drywall hung and taped"
  - "Paint - first coat"

- **Decision Points**: Highlight areas needing client attention
  - "Tile selection needed here"
  - "Light fixture location TBD"

- **Quality Checks**: Document inspections passed
  - "Electrical inspection passed 3/15"
  - "Final building inspection approved"

### File Management
- **Naming**: Use descriptive names (e.g., "Kitchen_North_2026-05-27")
- **Frequency**: Weekly updates recommended for active projects
- **Storage**: Large files (10-30MB each) - consider compression
- **Organization**: Upload in chronological order

## Integration Points

### Estimator Dashboard
- **Location**: Estimator → Projects → [Project] → Site Walk tab
- **Permissions**: All estimator team members can upload and mark
- **Workflow**: Part of regular site documentation routine

### Customer Portal
- **Location**: Customer Portal → Site Walk tab (conditional)
- **Visibility**: Only shown if project has 360° photos
- **Read-Only**: Clients can view but not add/modify markers
- **Mobile-Friendly**: Works on phones and tablets

## Technical Notes

### Browser Support
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS and macOS)
- Mobile: iOS 13+, Android 8+

### Performance
- **Load Time**: 2-5 seconds per 360° photo (depends on file size)
- **Memory**: ~50-100MB per high-res photo in browser
- **Recommendation**: Compress images to <10MB when possible

### Image Format
- **Required**: Equirectangular projection
- **Aspect Ratio**: 2:1 (width:height)
- **Common Resolutions**:
  - 4000x2000 (minimum recommended)
  - 6000x3000 (good quality)
  - 8000x4000 (high quality)

### Marker Coordinates
- **Pitch**: -90° (straight down) to +90° (straight up)
- **Yaw**: -180° to +180° (full circle)
- **Storage**: Saved as decimal degrees in entity

## Troubleshooting

### Photo Not Loading
- Check file format (must be equirectangular)
- Verify file uploaded successfully (check URL)
- Try smaller file size (<20MB)
- Ensure browser supports WebGL

### Markers Not Appearing
- Check if in edit mode (markers always visible to editors)
- Verify marker data saved in entity
- Refresh page to reload viewer with hotspots

### Viewer Controls Not Working
- Clear browser cache
- Update browser to latest version
- Check JavaScript console for errors
- Try different browser

### Mobile Issues
- Ensure touch events enabled
- Check device orientation lock
- Close other apps to free memory
- Use landscape mode for better viewing

## Future Enhancements

Potential improvements:
- [ ] Multi-scene tours (navigate between rooms)
- [ ] Before/after comparison slider
- [ ] Measurement tools within 360° view
- [ ] Voice notes attached to markers
- [ ] Automatic thumbnail generation
- [ ] Photo compression on upload
- [ ] Annotation drawing tools
- [ ] Export 360° photos with markers as PDF report

## Cost Considerations

### Storage
- Average 360° photo: 10-20MB
- Monthly storage (weekly uploads): 40-80MB/project
- Storage costs: ~$0.023/GB/month (Base44)

### Bandwidth
- Client views: ~10-20MB per view
- High-traffic projects: Consider CDN optimization

### Camera Equipment (Optional)
- Entry 360° cameras: $200-500 (Ricoh Theta, Insta360 One)
- Pro cameras: $1000-3000 (higher resolution, better low-light)
- Smartphone alternatives: 360° clip-on lenses ($50-100)

## Security

- **Access Control**: Only authenticated users can access
- **Client Isolation**: Clients only see their own project photos
- **Upload Validation**: File type and size limits enforced
- **URL Expiry**: Signed URLs for private file access (if needed)