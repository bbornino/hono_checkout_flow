import { useState } from "react"
import { useNavigate } from "react-router"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z as zod } from 'zod'
import { jwtDecode } from "jwt-decode"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

const signupSchema = zod.object({
    firstName: zod.string().min(1, 'First name is required').max(50),
    lastName: zod.string().min(1, 'Last name is required').max(50),
    email: zod.email(),
    password: zod.string().min(2, 'Password is required'),
    marketingOptIn: zod.boolean(),
})

type SignupFormData = zod.infer<typeof signupSchema>

function Signup() {
    const navigate = useNavigate()
    const setAuth = useAuthStore((state) => state.setAuth)
    const [serverError, setServerError] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        control,
        formState: {errors},
    } = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: {marketingOptIn: false },
    })

    async function onSubmit(values: SignupFormData) {
        setServerError(null)

        console.log(import.meta.env.VITE_API_URL)

        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/signup`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...values, role: 'customer'}),
        })

        if (!response.ok) {
            const body = await response.json()
            setServerError(body.error?.formErrors?.[0] ?? 'Signup Failed')
            return
        }

        const loginResponse = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: values.email, password: values.password }),
        })

        const loginData = await loginResponse.json()
        const decoded = jwtDecode<{ userId: number; role: string }>(loginData.token)
        setAuth(loginData.token, decoded.role)
        navigate('/')
    }

    return (
        <div className="mx-auto max-w-sm">
            <h1 className="mb-4 text-2xl font-bold">Sign Up</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" {...register('firstName')} />
                    {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>}
                </div>
                <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" {...register('lastName')} />
                    {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>}
                </div>
                <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" {...register('email')} />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
                </div>
                <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" {...register('password')} />
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
                </div>
                <div className="flex items-center gap-2">
                    <Controller name="marketingOptIn" control={control}
                        render={({ field }) => (
                            <Checkbox id="marketingOptIn"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <Label htmlFor="marketingOptIn">Send me marketing emails</Label>
                </div>

                {serverError && <p className="text-sm text-red-600">{serverError}</p>}

                <Button type="submit" className="w-full">Sign Up</Button>
            </form>
        </div>
    )
}

export default Signup