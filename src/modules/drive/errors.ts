export class DriveError extends Error {
  constructor(
    public readonly code:
      | "SIGN_IN"
      | "RECONNECT"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "RATE_LIMIT"
      | "UNAVAILABLE"
      | "INVALID_INPUT",
    public readonly status: number,
  ) {
    super(code);
  }
}

export function driveErrorMessage(error: unknown) {
  if (!(error instanceof DriveError))
    return "Google Drive ist gerade nicht erreichbar. Bitte versuche es erneut.";
  const messages = {
    SIGN_IN: "Bitte verbinde dich zuerst mit Google.",
    RECONNECT:
      "Die Verbindung ist abgelaufen oder nicht vollständig. Bitte verbinde Google Drive erneut.",
    FORBIDDEN:
      "Kein Zugriff. Prüfe das Google-Konto, die Drive-Freigabe und ob die Drive API im Cloud-Projekt aktiviert ist.",
    NOT_FOUND:
      "Dieser Ordner wurde nicht gefunden oder ist nicht mehr zugänglich.",
    RATE_LIMIT:
      "Google begrenzt gerade die Anfragen. Bitte versuche es später erneut.",
    UNAVAILABLE:
      "Google Drive ist gerade nicht erreichbar. Bitte versuche es erneut.",
    INVALID_INPUT: "Bitte wähle einen gültigen Ordner unter Meine Ablage.",
  };
  return messages[error.code];
}
