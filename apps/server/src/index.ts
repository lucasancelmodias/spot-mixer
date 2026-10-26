import { createApp } from './app';
import { createRedis, redisPinger } from './cache/redis';
import { ConfigError, loadConfig } from './config';

function readConfig() {
	try {
		return loadConfig(process.env);
	} catch (error) {
		if (error instanceof ConfigError) {
			console.error(error.message);
			process.exit(1);
		}
		throw error;
	}
}

const config = readConfig();
const redis = createRedis(config.REDIS_URL);
const app = createApp({ pingRedis: redisPinger(redis), staticDir: config.STATIC_DIR });

const server = Bun.serve({
	hostname: config.HOST,
	port: config.PORT,
	fetch: app.fetch,
	// Bun closes idle connections after 10 s by default. A cold mix preview can take longer.
	idleTimeout: 120
});

console.log(`spot-mixer API listening on ${server.url}`);

async function shutdown(): Promise<void> {
	await server.stop();
	redis.close();
	process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
