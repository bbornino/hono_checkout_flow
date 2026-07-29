import 'dotenv/config'
const BASE_URL = process.env.TEST_BASE_URL!

async function checkServer() {
    try {
        const res = await fetch(`${BASE_URL}/health`)
        if (!res.ok) throw new Error(`Server responded with status ${res.status}`)
        console.log('✅ Dev server is reachable.\n')
        process.exit(0)
    } catch {
        console.error(`\n❌ Dev server isn't reachable at ${BASE_URL}`)
        console.error(`   Run "pnpm dev" in a separate terminal before running tests.\n`)
        process.exit(1)
    }
}

checkServer()