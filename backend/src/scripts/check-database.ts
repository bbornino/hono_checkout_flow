import 'dotenv/config'
import {db} from '../db/index.js'
import {sql} from 'drizzle-orm'

async function checkDatabase() {
    try {
        await db.execute(sql`SELECT 1`)
        console.log('✅ Database is reachable.\n')
        process.exit(0)
    } catch {
        console.error(`\n❌ Database isn't reachable.`)
        console.error(`   Check that the pg16-hono Docker container is running: docker ps\n`)
        process.exit(1)
    }
}

checkDatabase()