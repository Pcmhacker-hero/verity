/** Findings Dashboard — Doc 12 §6.10. Filterable list of verification findings. */
export default function FindingsPage({ params: _params }: { params: Promise<{ projectId: string }> }) {
  return (
    <div>
      <h1>Verification Findings</h1>
      {/* TODO: FindingsList with severity/specArea/status filters */}
    </div>
  );
}
