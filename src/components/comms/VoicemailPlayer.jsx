/**
 * Inline player for the uploaded Google Voice recording. preload="none" keeps
 * list views light — audio only downloads when someone presses play.
 */
export default function VoicemailPlayer({ url, className = "" }) {
  if (!url) return null;
  return (
    <audio
      controls
      preload="none"
      src={url}
      className={`h-8 w-full max-w-xs mt-1.5 ${className}`}
      onClick={e => e.stopPropagation()}
    >
      <a href={url} target="_blank" rel="noreferrer">Listen to voicemail</a>
    </audio>
  );
}
