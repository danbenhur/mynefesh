export type AppScreen = 'home' | 'umbrellas' | 'umbrella' | 'chat' | 'checkin' | 'profile' | 'settings'

export interface ScreenData {
  umbrellaId?: string
}

export type NavigateFn = (screen: AppScreen, data?: ScreenData) => void
