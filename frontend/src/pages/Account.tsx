import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z as zod } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type CustomerProfile = {
    id: number
    firstName: string
    lastName: string
    email: string
    phone: string | null
    marketingOptIn: boolean
}

const profileSchema = zod.object({
    firstName: zod.string().min(3).max(50),
    lastName: zod.string().min(3).max(50),
    email: zod.email(),
    phone: zod.string().optional(),
    marketingOptIn: zod.boolean(),
})

type ProfileFormData = zod.infer<typeof profileSchema>

const passwordSchema = zod.object({
    currentPassword: zod.string().min(1, 'Current password is required'),
    newPassword: zod.string().min(2, 'New password is required'),
})

type PasswordFormData = zod.infer<typeof passwordSchema>

function extractError(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err)) {
        const fieldErrors = err.response?.data?.error?.fieldErrors
        const firstFieldError = fieldErrors ? (Object.values(fieldErrors)[0] as string[] | undefined) : undefined
        const plainError = err.response?.data?.error
        if (firstFieldError?.[0]) return firstFieldError[0]
        if (typeof plainError === 'string') return plainError
    }

    return fallback
}


function Account() {
    const queryClient = useQueryClient()
    const setAuth = useAuthStore((state) => state.setAuth)
    const role = useAuthStore((state) => state.role)
    const [profileError, setProfileError] = useState<string | null>(null)
    const [profileSuccess, setProfileSuccess] = useState(false)
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [passwordSuccess, setPasswordSuccess] = useState(false)

    const { data: customer, isLoading } = useQuery<CustomerProfile>({
        queryKey: ['myCustomer'],
        queryFn: () => api.get('/customers/me').then((res) => res.data),
    })

    const profileForm = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        values: customer
            ? {
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phone: customer.phone ?? '',
                marketingOptIn: customer.marketingOptIn,
            }
        : undefined,
    })

    const passwordForm = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema)
    })

    async function onSubmitProfile(values: ProfileFormData) {
        setProfileError(null)
        setProfileSuccess(false)

        try {
            await api.patch(`/customers/${customer!.id}`, values)
            queryClient.invalidateQueries({ queryKey: ['myCustomer']})
            if (values.email !== customer!.email && role) {
                setAuth(useAuthStore.getState().token!, role, values.email)
            }
            setProfileSuccess(true)
        } catch (err) {
            setProfileError(extractError(err, 'Failed to update profile'))
        }
    }

    async function onSubmitPassword(values: PasswordFormData) {
        setPasswordError(null)
        setPasswordSuccess(false)
        try {
            await api.patch('/auth/password', values)
            passwordForm.reset()
            setPasswordSuccess(true)
        } catch (err) {
            setPasswordError(extractError(err, 'Failed to change password'))
        }
    }

    if (isLoading) return <p>Loading account...</p>

    return (
        <div className="mx-auto max-w-sm space-y-8">
            <h1 className="text-2xl font-bold">My Account</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Profile Info</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={profileForm.handleSubmit(onSubmitProfile)}
                        className="space-y-4">
                        <div>
                            <Label htmlFor="firstName">First Name</Label>
                            <Input id="firstName" {...profileForm.register('firstName')} />
                            {profileForm.formState.errors.firstName && (
                                <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.firstName.message}</p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input id="lastName" {...profileForm.register('lastName')} />
                            {profileForm.formState.errors.lastName && (
                                <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.lastName.message}</p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" {...profileForm.register('email')} />
                            {profileForm.formState.errors.email && (
                                <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.email.message}</p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="phone">Phone (optional)</Label>
                            <Input id="phone" placeholder="+15551234567" {...profileForm.register('phone')} />
                        </div>
                        <div className="flex items-center gap-2">
                            <Controller
                                name="marketingOptIn"
                                control={profileForm.control}
                                render={({ field }) => (
                                    <Checkbox
                                        id="marketingOptIn"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                )}
                            />
                            <Label htmlFor="marketingOptIn">Send me marketing emails</Label>
                        </div>

                        {profileError && <p className="text-sm text-red-600">{profileError}</p>}
                        {profileSuccess && <p className="text-sm text-green-600">Profile updated.</p>}

                        <Button type="submit">Save Profile</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
                        <div>
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <Input id="currentPassword" type="password" {...passwordForm.register('currentPassword')} />
                            {passwordForm.formState.errors.currentPassword && (
                                <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input id="newPassword" type="password" {...passwordForm.register('newPassword')} />
                            {passwordForm.formState.errors.newPassword && (
                                <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.newPassword.message}</p>
                            )}
                        </div>

                        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                        {passwordSuccess && <p className="text-sm text-green-600">Password changed.</p>}

                        <Button type="submit">Update Password</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

export default Account