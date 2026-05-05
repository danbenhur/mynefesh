export type AppScreen = 'home' | 'umbrellas' | 'umbrella' | 'chat' | 'checkin' | 'profile'

export interface ScreenData {
  umbrellaId?: string
}

export type NavigateFn = (screen: AppScreen, data?: ScreenData) => void
