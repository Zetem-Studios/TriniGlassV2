type UserAgentData = { mobile?: boolean };

function detectMobilePhone(): boolean {
  if (typeof navigator === "undefined") return false;

  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") {
    return uaData.mobile;
  }

  // Fallback por user-agent. Solo teléfonos: Android *con* "Mobile",
  // iPhone/iPod, BlackBerry, Windows Phone, webOS. Excluye tablets.
  const ua = navigator.userAgent || "";
  return /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|webOS/i.test(ua);
}

export function useIsMobilePhone(): boolean {
  return detectMobilePhone();
}
