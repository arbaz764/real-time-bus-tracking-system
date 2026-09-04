const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

const adminClients = new Set();
const messageHistory = []; // Store all messages

wss.on('connection', (ws) => {
    console.log('New client connected');
    ws.isAuthenticated = false;

    // Send message history to the new client
    if (messageHistory.length > 0) {
        ws.send(JSON.stringify({
            type: 'history',
            messages: messageHistory
        }));
    }

    ws.on('message', (message) => {
        try {
            console.log('Message received from client:', message);
            const data = JSON.parse(message);

            // Handle authentication
            if (data.type === 'auth') {
                if (data.password === 'admin123') {
                    ws.isAuthenticated = true;
                    adminClients.add(ws);
                    ws.send(JSON.stringify({
                        type: 'auth-response',
                        success: true
                    }));
                    console.log('Client authenticated as admin');
                } else {
                    ws.send(JSON.stringify({
                        type: 'auth-response',
                        success: false
                    }));
                    console.log('Client authentication failed');
                }
                return;
            }

            // Handle messages only from authenticated admins
            if (ws.isAuthenticated && data.type === 'message') {
                console.log('Broadcasting message:', data.content);
                // Add the message to the history
                messageHistory.push(data.content);
                // Broadcast to all clients (both admins and regular users)
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'message',
                            content: data.content
                        }));
                    }
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        adminClients.delete(ws);
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on https://community-chats.onrender.com/`);
});