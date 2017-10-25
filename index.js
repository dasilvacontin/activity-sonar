const perfect = require('perfect-env')
const express = require('express')
const got = require('got')
const app = express()

const {
    PORT,
    CLIENT_ID,
    CLIENT_SECRET,
    AUTHORIZATION_REDIRECT_URI
} = perfect.env

app.use(express.static('public'))

app.get('/compute', function (req, res) {
    res.setHeader('Content-Type', 'text/html')
    const { code } = req.query

    const options = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: AUTHORIZATION_REDIRECT_URI,
        code: code
    }
    console.log('sending options')
    console.log(options)

    let access_token, user, posts
    const interactions = {}
    got.post('https://api.instagram.com/oauth/access_token', {
        body: options,
        form: true,
        json: true
    }).then(response => {
        access_token = response.body.access_token
        user = response.body.user
        return got.get(`https://api.instagram.com/v1/users/self/media/recent/?access_token=${access_token}`, { json: true })
    }).then(response => {
        console.log('posts')
        posts = response.body.data
        console.log(`gonna analyze ${posts.length} posts`)

        const promises = []
        posts.forEach(p => {
            const mediaId = p.id
            const commentsP = got.get(`https://api.instagram.com/v1/media/${mediaId}/comments?access_token=${access_token}`, { json: true })
            .then(response => {
                const comments = response.body.data
                comments.forEach(c => {
                    const from = c.from.username
                    const userInteractions = interactions[from] || { 
                        username: from,
                        comments: 0,
                        likes: 0
                    }
                    userInteractions.comments++
                    res.write(`comment from ${from}<br>`)
                })
            })
            promises.push(commentsP)

            const likesP = got.get(`https://api.instagram.com/v1/media/${mediaId}/likes?access_token=${access_token}`, { json: true })
            .then(response => {
                const likes = response.body.data
                console.log(likes)
                likes.forEach(l => {
                    const from = l.username
                    const userInteractions = interactions[from] || { 
                        username: from,
                        comments: 0,
                        likes: 0
                    }
                    userInteractions.likes++
                    res.write(`like from ${from}<br>`)
                })
            })
            promises.push(likesP)
        })

        return Promise.all(promises)
    }).then(_ => {
        res.write(
            `posts analyzed: ${posts.length}<br><br>` +
            Object.values(interactions).map(u => {
                u.score = u.comments * 7 + u.likes
            }).sort((u1, u2) => u2.score - u1.score)
            .map(u => `${u.username}. score: ${u.score}. comments: ${u.comments}. likes: ${u.likes}`)
            .join('<br>')
        )
        res.end()
    }).catch(error => {
        console.log(error)
        console.log(error.response.body)
    })

})

app.listen(PORT, () => {
    console.log(`express started listening on port ${PORT}`)
})