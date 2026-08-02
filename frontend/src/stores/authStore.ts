import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthState = {
    token: string | null
    role: string | null
    setAuth: (token: string, role: string) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            role: null,
            setAuth: (token, role) => set({token, role}),
            logout: () => set({ token: null, role: null})
        }),
        {
            name: 'auth-storage'
        }
    )
)