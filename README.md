# Start Database Server
`docker-compose up`

# Install Dependencies
`npm i`

# Insert Records
`npm start`

# Connect to Database Server
`docker container exec -it $CONTAINER_ID sh`

`psql -U test`

# View Activity Log
`SELECT * FROM activity_log;`

`SELECT * FROM transaction_log;`

`SELECT * FROM entity_state ORDER BY transaction_id;`

# Stop Database Server
`docker-compose down`
