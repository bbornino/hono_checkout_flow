import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'


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

type CheckoutConfig = {
    taxRate: number
    shippingCents: number
}

type DiscountResult = {
    valid: boolean
    discountType?: string
    percentageOff?: number
    fixedCents?: number
    error?: string
}

function formatAddress(address: Address) {
    return (
        <>
            {address.label && <span className='font-medium'>{address.label}: </span>}
            {address.addressLine1}
            {address.addressLine2 && `, ${address.addressLine2}`}
            {address.city}, {address.state} {address.postalCode}, {address.country} 
        </>
    )
}

function Checkout() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { items, clearCart } = useCartStore()

    const [selectedAddressId, setSelectedAddressId] = useState<string>('')
    const [sameBillingAddress, setSameBillingAddress] = useState(true)
    const [selectedBillingAddressId, setSelectedBillingAddressId] = useState<string>('')

    const [discountCode, setDiscountCode] = useState('')
    const [discountResult, setDiscountResult] = useState<DiscountResult | null>(null)
    const [checkingDiscount, setCheckingDiscount] = useState(false)

    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const { data: addresses, isLoading: addressesLoading } = useQuery<Address[]>({
        queryKey: ['addresses'],
        queryFn: () => api.get('/addresses').then((res) => res.data),
    })

    const { data: config } = useQuery<CheckoutConfig>({
        queryKey: ['checkoutConfig'],
        queryFn: () => api.get('/checkout/config').then((res) => res.data),
    })

    const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)

    let estimatedDiscountCents = 0
    if (discountResult?.valid) {
        estimatedDiscountCents =
            discountResult.discountType === 'percentage'
                ? Math.round(subtotalCents * ((discountResult.percentageOff ?? 0) / 100 ))
                : discountResult.fixedCents ?? 0
    }

    const estimatedTaxCents = Math.round(subtotalCents * (config?.taxRate ?? 0))
    const estimatedShippingCents = config?.shippingCents ?? 0
    const estimatedTotalCents = subtotalCents - estimatedDiscountCents + estimatedTaxCents + estimatedShippingCents

    async function handleValidateDiscount() {
        if (!discountCode.trim()) return

        setCheckingDiscount(true)
        const response = await api.post('/discounts/validate', {code: discountCode.trim()})
        setDiscountResult(response.data)
        setCheckingDiscount(false)
    }

    async function handlePlaceOrder() {
        setSubmitError(null)

        if (!selectedAddressId) {
            setSubmitError('Please select a shipping address')
            return
        }

        if (!sameBillingAddress && !selectedBillingAddressId) {
            setSubmitError('Please seklect a billing address')
            return
        }

        setSubmitting(true)

        try {
            await api.post('/orders', {
                shippingAddressId: Number(selectedAddressId), 
                billingAddressId: sameBillingAddress ? Number(selectedAddressId) : Number(selectedBillingAddressId),
                discountCode: discountResult?.valid ? discountCode.trim() : undefined,
                items: items.map((item) => ({productId: item.productId, quantity: item.quantity})), 
            })

            clearCart()
            queryClient.invalidateQueries({ queryKey: ['orders']})
            navigate('/orders')
        } catch {
            setSubmitError('Failed to place order.  Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (items.length === 0) {
        return (
            <div>
                <h1 className='mb-4 text-2xl font-bold'>Checkout</h1>
                <p className='text-gray-500'>Your cart is empty.</p>
                <Link to="/" className='mt-2 inline-block text-sm text-blue-600 hover:underline'>
                    Browse Products
                </Link>
            </div>
        )
    }

    return (
        <div className='mx-auto max-w-2xl space-y-6'>
            <h1 className='text-2xl font-bold'>Checkout</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent>
                    {addressesLoading ? (
                        <p>Loading addresses...</p>
                    ) : addresses?.length === 0 ? (
                        <div>
                            <p className='mb-2 text-gray-500'>You have no saved addresses.</p>
                            <Link to="/addresses" className='text-sm text-blue-600 hover:underline'>
                                Add an address
                            </Link>
                        </div>
                    ) : (
                        <>
                            <RadioGroup value={selectedAddressId}
                                    onValueChange={setSelectedAddressId}>
                                {addresses?.map((address) => (
                                    <div key={address.id} className='flex items-center gap-2 rounded-md border p-3'>
                                        <RadioGroupItem value={String(address.id)} 
                                            id={`shipping-${address.id}`} data-testid={`shipping-address-${address.id}`}/>
                                        <Label htmlFor={`shipping-${address.id}`} className="flex-1 cursor-pointer">
                                            {formatAddress(address)}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>

                            <div className='mt-3 flex items-center gap-2'>
                                <Checkbox
                                    id='sameBilling'
                                    checked={sameBillingAddress}
                                    onCheckedChange={(checked) => setSameBillingAddress(checked === true)}
                                />
                                <Label htmlFor='sameBilling'>Billing address is the same as shipping</Label>
                            </div>

                            {!sameBillingAddress && (
                                <div className='mt-3'>
                                    <Label className='mb-2 block'>Billing Address</Label>
                                    <RadioGroup value={selectedBillingAddressId} onValueChange={setSelectedBillingAddressId}>
                                        {addresses?.map((address) => (
                                            <div key={address.id} className='flex items-center gap-2 rounded-md border p-3'>
                                                <RadioGroupItem value={String(address.id)} id={`billing-${address.id}`} />
                                                <Label htmlFor={`billing-${address.id}`} className='flex-1 cursor-pointer'>
                                                    {formatAddress(address)}
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Discount Code</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='flex gap-2'>
                        <Input
                            value={discountCode}
                            onChange={(e) => {
                                setDiscountCode(e.target.value)
                                setDiscountResult(null)
                            }}
                            placeholder="Enter a code"
                        />
                        <Button type='button' variant="outline" 
                                onClick={handleValidateDiscount}
                                disabled={checkingDiscount}>
                            {checkingDiscount ? 'Checking...' : 'Apply'}
                        </Button>
                    </div>
                    {discountResult && (
                        <p className={`mt-2 text-sm ${discountResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                            {discountResult.valid ? 'Code applied!' : discountResult.error}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className='space-y-2'>
                    {items.map((item) => (
                        <div key={item.productId} className='flex justify-between text-sm'>
                            <span>{item.name} x {item.quantity}</span>
                            <span>${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
                        </div>
                    ))}

                    <div className='border-t pt-2 text-sm text-gray-500'>
                        <p>Estimated - final total calculated at order placement</p>
                    </div>

                    <div className='flex justify-between text-sm'>
                        <span>Subtotal</span>
                        <span>${(subtotalCents / 100).toFixed(2)}</span>
                    </div>
                    {estimatedDiscountCents > 0 && (
                        <div className='flex justify-between text-sm text-green-600'>
                            <span>Discount</span>
                            <span>${(estimatedDiscountCents / 100).toFixed(2)}</span>
                        </div>
                    )}
                    <div className='flex justify-between text-sm'>
                        <span>Estimated tax</span>
                        <span>${(estimatedTaxCents / 100).toFixed(2)}</span>
                    </div>
                    <div className='flex justify-between text-sm'>
                        <span>Shipping</span>
                        <span>${(estimatedShippingCents / 100).toFixed(2)}</span>
                    </div>
                    <div className='flex justify-between border-t pt-2 font-bold'>
                        <span>Estimated Total</span>
                        <span>${(estimatedTotalCents / 100).toFixed(2)}</span>
                    </div>

                    {submitError && <p className='text-sm text-red-600'>{submitError}</p>}

                    <Button className='w-ful' size="lg" onClick={handlePlaceOrder} 
                            disabled={submitting} data-testid="place-order-button">
                        {submitting ? 'Placing Order...' : 'Place Order'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

export default Checkout