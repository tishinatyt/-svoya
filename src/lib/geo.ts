// Chernihiv, Ukraine default coords
export const DEFAULT_LAT = 51.4930
export const DEFAULT_LNG = 31.2945

export interface Coords {
  lat: number
  lng: number
}

export function getDevicePosition(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60_000 }
    )
  })
}

export async function getCurrentPosition(fallback: Coords = { lat: DEFAULT_LAT, lng: DEFAULT_LNG }): Promise<Coords> {
  return await getDevicePosition() ?? fallback
}
