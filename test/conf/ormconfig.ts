import { ConnectionOptions } from 'typeorm'
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'

export const config: ConnectionOptions = {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "test",
    "password": "test",
    "database": "test",
    "synchronize": true,
    "logging": false,
    "entities": [
        "src/data/entity/**/*.ts",
        "test/entity/**/*.ts"
    ],
    "migrations": [
        "src/migration/**/*.ts"
    ],
    "subscribers": [
        "src/listener/**/*.ts"
    ],
    "cli": {
        "entitiesDir": "src/data/entity",
        "migrationsDir": "src/migration",
        "subscribersDir": "src/listener"
    },
    namingStrategy: new SnakeNamingStrategy()
}