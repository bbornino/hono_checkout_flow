import { useState } from "react"
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {z as zod } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate } from "react-router"
import { useAuthStore } from "@/stores/authStore"
import { jwtDecode } from 'jwt-decode'

const loginSchema = zod.object({
    email: zod.email(),
    password: zod.string().min(1, 'Password is required'),
})

type LoginFormData = zod.infer<typeof loginSchema>

function Login() {
    const [serverError, setServerError] = useState<string | null>(null)
    const navigate = useNavigate()
    const setAuth = useAuthStore((state) => state.setAuth)

    const {
        register,
        handleSubmit,
        formState: {errors},
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    })

    async function onSubmit(values: LoginFormData) {
        setServerError(null)

        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values)
        })

        if (!response.ok) {
            setServerError('Invalid email or password')
            return
        }

        const data = await response.json()
        const decoded = jwtDecode<{userId: number; role: string}>(data.token)
        setAuth(data.token, decoded.role, values.email)

        navigate('/')
    }

    return (
        <div className="mx-auto max-w-sm">
            <h1 className="mb-4 text-2xl font-bold">Login</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register('email')} />
                    {errors.email && (
                        <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                </div>

                <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" {...register('password')} />
                    {errors.password && (
                        <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                    )}
                </div>

                {serverError && <p className="text-sm text-red-600">{serverError}</p>}

                <Button type="submit" className="w-full">Log In</Button>
            </form>
            
        </div>
    )
}

export default Login