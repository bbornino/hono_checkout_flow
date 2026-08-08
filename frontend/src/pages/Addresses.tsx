import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z as zod } from 'zod'
import axios from "axios"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

type Address = {
    id: number
    label: string | null
    addressLine1: string
    addressLine2: string | null
    city: string
    state: string
    postalCode: string
    country: string
}

const addressSchema = zod.object({
    label: zod.string().max(50).optional(),
    addressLine1: zod.string().min(1, 'Address is required').max(255),
    addressLine2: zod.string().max(255).optional(),
    city: zod.string().min(1, 'City is required').max(100),
    state: zod.string().min(1, 'State is required').max(50),
    postalCode: zod.string().min(1, 'Postal code is required').max(20),
    country: zod.string().length(2).regex(/^[A-Za-z]{2}$/, 'Must be a 2-letter ISO country code').toUpperCase()
})

type AddressFormData = zod.infer<typeof addressSchema>

function Addresses() {
    const queryClient = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [serverError, setServerError] = useState<string | null>(null)

    const {data, isLoading } = useQuery<Address[]>({
        queryKey: ['addresses'],
        queryFn: () => api.get('/addresses').then((res) => res.data),
    })

    const { register, handleSubmit, reset, formState: {errors},
    } = useForm<AddressFormData>({
        resolver: zodResolver(addressSchema)
    })

    function startAdd() {
        reset({ label: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: ''})
        setEditingId(null)
        setShowForm(true)
    }

    function startEdit(address: Address) {
        reset({
            label: address.label ?? '',
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2 ?? '',
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
        })
        setEditingId(address.id)
        setShowForm(true)
    }

    async function onSubmit(values: AddressFormData) {
        setServerError(null)

        const payload = {
            ...values,
            label: values.label?.trim() ? values.label : undefined,
        }
        try {
            if (editingId) {
                await api.patch(`/addresses/${editingId}`, payload)
            } else {
                await api.post('/addresses', payload)
            }
            queryClient.invalidateQueries({ queryKey: ['addresses'] })
            reset()
            setShowForm(false)
            setEditingId(null)
        } catch (err) {
            if (axios.isAxiosError(err)) {
                const fieldErrors = err.response?.data?.error?.fieldErrors
                const firstFieldError = fieldErrors ? (Object.values(fieldErrors)[0] as string[] | undefined) : undefined
                setServerError(firstFieldError?.[0] ?? 'Failed to save address')
            } else {
                setServerError('Failed to save address')
            }
        }
    }

    async function handleDelete(id: number) {
        // Normally, I'd put in a confirmation modal first!
        await api.delete(`/addresses/${id}`)
        queryClient.invalidateQueries({queryKey: ['addresses']})
    }

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">My Addresses</h1>
                <Button onClick={showForm ? () => setShowForm(false) : startAdd}>
                    {showForm ? 'Cancel' : 'Add Address'}
                </Button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit(onSubmit)} className="mb-6 max-w-sm space-y-4">
                    <div>
                        <Label htmlFor="label">Label (optional)</Label>
                        <Input id="label" placeholder="Home, Work..." {...register('label')} />
                    </div>

                    <div>
                        <Label htmlFor="addressLine1">Address</Label>
                        <Input id="addressLine1" {... register('addressLine1')} />
                        {errors.addressLine1 && <p className="mt-1 text-sm text-red-600">{errors.addressLine1.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="addressLine2">Address Line 2 (optional)</Label>
                        <Input id="addressLine2" placeholder="Apt, suite, unit..." {... register('addressLine2')} />
                    </div>

                    <div>
                        <Label htmlFor="city">City</Label>
                        <Input id="city" {...register('city')} />
                        {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="state">State</Label>
                        <Input id="state" {...register('state')} />
                        {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input id="postalCode" {...register('postalCode')} />
                        {errors.postalCode && <p className="mt-1 text-sm text-red-600">{errors.postalCode.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="country">Country (2-letter code)</Label>
                        <Input id="country" placeholder="US" {...register('country')} />
                        {errors.country && <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>}
                    </div>

                    {serverError && <p className="text-sm text-red-600">{serverError}</p>}

                    <Button type="submit">{editingId ? 'Update Address' : 'Save Address'} </Button>
                </form>
            )}

            {isLoading ? (
                <p>Loading addresses...</p>
            ) : data?.length === 0 ? (
                <p className="text-gray-500">No addresses saved yet.</p>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {data?.map((address) => (
                        <Card key={address.id} data-testid={`address-card-${address.id}`}>
                            <CardContent>
                                {address.label && <p className="font-medium">{address.label}</p>}
                                <p>{address.addressLine1}</p>
                                {address.addressLine2 && <p>{address.addressLine2}</p>}
                                <p>{address.city}, {address.state} {address.postalCode}</p>
                                <p>{address.country}</p>

                                <div className="mt-3 flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => startEdit(address)}>
                                        Edit
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDelete(address.id)}>
                                        Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Addresses