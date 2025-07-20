const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let activeSessions = {};
let totalVisitorsToday = 0;
let pagesVisited = {};

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

wss.on('connection', function connection(ws) {
  ws.send(JSON.stringify({
    type: 'user_connected',
    data: {
      totalDashboards: wss.clients.size,
      connectedAt: new Date().toISOString()
    }
  }));

  ws.on('close', () => {
    broadcast({
      type: 'user_disconnected',
      data: {
        totalDashboards: wss.clients.size - 1
      }
    });
  });

  ws.on('message', function incoming(message) {
    const parsed = JSON.parse(message);

    if (parsed.type === 'request_detailed_stats') {
      const { filter } = parsed;

      ws.send(JSON.stringify({
        type: 'visitor_update',
        data: {
          event: null,
          stats: {
            totalActive: Object.keys(activeSessions).length,
            totalToday: totalVisitorsToday,
            pagesVisited,
            sessions: Object.values(activeSessions).map(s => ({
              sessionId: s.sessionId,
              currentPage: s.currentPage,
              journey: s.journey,
              duration: Math.floor((new Date() - s.startTime) / 1000),
            }))
          }
        }
      }));
    }
  });
});

app.post('/api/events', (req, res) => {
  const event = req.body;

  const { type, page, sessionId, timestamp, country } = event;

  if (!type || !page || !sessionId || !timestamp || !country) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!activeSessions[sessionId]) {
    activeSessions[sessionId] = {
      sessionId,
      journey: [],
      currentPage: '',
      startTime: new Date(timestamp),
      lastSeen: new Date(timestamp)
    };
    totalVisitorsToday++;
  }

  const session = activeSessions[sessionId];
  session.journey.push(page);
  session.currentPage = page;
  session.lastSeen = new Date(timestamp);

  pagesVisited[page] = (pagesVisited[page] || 0) + 1;

  const stats = {
    totalActive: Object.keys(activeSessions).length,
    totalToday: totalVisitorsToday,
    pagesVisited,
    sessions: Object.values(activeSessions).map(s => ({
      sessionId: s.sessionId,
      currentPage: s.currentPage,
      journey: s.journey,
      duration: Math.floor((new Date() - s.startTime) / 1000),
    }))
  };

  broadcast({
    type: 'visitor_update',
    data: { event, stats }
  });

  broadcast({
    type: 'session_activity',
    data: {
      sessionId,
      currentPage: page,
      journey: session.journey,
      duration: Math.floor((new Date(timestamp) - session.startTime) / 1000)
    }
  });

  if (Math.random() < 0.2) {
    broadcast({
      type: 'alert',
      data: {
        level: 'info',
        message: 'New visitor spike detected!',
        details: { visitorsLastMinute: 25 }
      }
    });
  }

  res.status(200).json({ success: true });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


