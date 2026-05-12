export type AppScreen = 'home' | 'umbrellas' | 'umbrella' | 'chat' | 'checkin' | 'profile' | 'settings' | 'interview'

export interface ScreenData {
  umbrellaId?: string
}

export type NavigateFn = (screen: AppScreen, data?: ScreenData) => void
