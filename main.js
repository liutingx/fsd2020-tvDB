//load libraries
const express = require('express')
const handlebars = require('express-handlebars')
const mysql = require('mysql2/promise')

//SQL
const SQL_GET_TV_NAMES = 'select tvid, name from tv_shows order by name desc limit ?'
const SQL_GET_INFO_BY_TVID = 'select name, rating, image, summary, official_site from tv_shows where tvid = ?'

const limit = 10

//create express instance
const app = express()

//set up PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

const mkQuery = (sqlStmt, pool) => {
    const f = async (params) => {
        const conn = await pool.getConnection()
        try {
            const results = await conn.query(sqlStmt, params)
            
            return results[0]
            }
        catch(e) {
            return Promise.reject(e)
        }
        finally {
            conn.release()
        }
    }
    return f
}

//configure connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306, 
    database: process.env.DB_NAME || 'leisure',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: 4, 
    timezone: '+08:00'
})


// configure handlebars
app.engine('hbs', handlebars({ defaultLayout: 'default.hbs' }))
app.set('view engine', 'hbs')

//create queries
const getTVList = mkQuery(SQL_GET_TV_NAMES, pool)
const getTVShowById = mkQuery(SQL_GET_INFO_BY_TVID, pool)

//application
app.get('/', async(req, resp) => {
    try {
        const results = await getTVList([limit])
        
        resp.status(200)
        resp.type('text/html')
        resp.render('index', {
            tvNames: results
        })
    }
    catch(e) {
        resp.status(500)
        resp.type('text/html')
        resp.send(JSON.stringify(e))
    }
})

app.get('/results/:tvid', async(req, resp) => {
    const tvid = req.params.tvid

    try {
        const recs = await getTVShowById([tvid])
        
        if (recs[0].official_site == ''){
            console.info('no official site')
        }
        
        if (recs.length <= 0) {
            //404!
            resp.status(404)
            resp.type('text/html')
            resp.send(`Not found: ${tvid}`)
            return
        }
        
        resp.status(200)
        resp.type('text/html')
        resp.render('result', {
            tvDetails: recs[0],
            noSite: !recs[0].official_site == ''
        })
    }
    catch(e) {
        resp.status(500)
        resp.type('text/html')
        resp.send(JSON.stringify(e))
    }
})

// start the server
pool.getConnection()
    .then(conn => {
        console.info('Pinging database...')
        const p0 = Promise.resolve(conn)
        const p1 = conn.ping()
        return Promise.all([ p0, p1 ])
    })
    .then(results => {
        const conn = results[0]
        // release the connection
        conn.release()

        // start the server
        app.listen(PORT, () => {
            console.info(`Application started on port ${PORT} at ${new Date()}`)
        })
    })
    .catch(e => {
        console.error('Cannot start server: ', e)
    })