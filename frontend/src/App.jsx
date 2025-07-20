import { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

function App() {
  const socketRef = useRef(null);
  const [status, setStatus] = useState('Disconnected');
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [visitorTimestamps, setVisitorTimestamps] = useState([]);
  const [alertMsg, setAlertMsg] = useState('');
  const [filter, setFilter] = useState({ country: '', page: '' });

  useEffect(() => {
    let socket;
    function connect() {
      socket = new WebSocket('ws://localhost:3000');
      socketRef.current = socket;

      socket.onopen = () => setStatus('Connected');
      socket.onclose = () => {
        setStatus('Reconnecting...');
        setTimeout(connect, 3000);
      };

      socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === 'visitor_update') {
          if (data.data.event) {
            setEvents(prev => [data.data.event, ...prev.slice(0, 9)]);
            setVisitorTimestamps(prev => {
              const now = new Date();
              const updated = [...prev, now].filter(t => now - t < 10 * 60 * 1000);
              return updated;
            });
          }

          setStats(data.data.stats);
          setSessions(data.data.stats.sessions || []);
        }

        if (data.type === 'session_activity') {
          console.log('Session activity:', data.data);
        }

        if (data.type === 'alert') {
          setAlertMsg(data.data.message);
          setTimeout(() => setAlertMsg(''), 4000);
        }
      };
    }

    connect();
    return () => socket.close();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      {alertMsg && (
        <div className="bg-yellow-100 text-yellow-800 p-3 text-center">
          ⚠️ {alertMsg}
        </div>
      )}

      <header className="bg-white shadow p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Realtime Analytics</h1>
          <nav>
            <a href="#" className="text-blue-600 hover:underline font-medium">Home</a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6 text-center">Visitor Analytics Dashboard</h2>

        <div className="mb-4 text-sm text-gray-600 text-center">
          Status: <span className={`font-semibold ${status === 'Connected' ? 'text-green-600' : 'text-red-600'}`}>{status}</span>
        </div>

        <div className="bg-white p-6 rounded shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Filter Events</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              className="border border-gray-300 p-2 rounded w-full md:w-1/3"
              placeholder="Country"
              value={filter.country}
              onChange={(e) => setFilter({ ...filter, country: e.target.value })}
            />
            <input
              className="border border-gray-300 p-2 rounded w-full md:w-1/3"
              placeholder="Page"
              value={filter.page}
              onChange={(e) => setFilter({ ...filter, page: e.target.value })}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full md:w-auto"
              onClick={() => {
                const socket = socketRef.current;
                if (socket && socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({
                    type: "request_detailed_stats",
                    filter: {
                      country: filter.country,
                      page: filter.page
                    }
                  }));
                }
              }}
            >
              Apply Filter
            </button>
          </div>
        </div>

        {stats && (
          <div className="bg-white p-6 rounded shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Visitor Summary</h3>
            <p><strong>Active Visitors:</strong> {stats.totalActive}</p>
            <p><strong>Total Today:</strong> {stats.totalToday}</p>
            <div className="mt-2">
              <p className="font-medium">Pages Visited:</p>
              <ul className="list-disc list-inside text-sm">
                {Object.entries(stats.pagesVisited).map(([page, count]) => (
                  <li key={page}>{page}: {count}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Visitors Over Time</h3>
          <Line
            data={{
              labels: visitorTimestamps.map(t => t.toLocaleTimeString()),
              datasets: [{
                label: 'Visitors',
                data: visitorTimestamps.map((_, i) => i + 1),
                borderColor: 'rgb(59, 130, 246)',
                tension: 0.3
              }]
            }}
          />
        </div>

        <div className="bg-white p-6 rounded shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">No sessions yet.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {sessions.map((s, i) => (
                <li key={i} className="border p-2 rounded">
                  <p><strong>ID:</strong> {s.sessionId}</p>
                  <p><strong>Current Page:</strong> {s.currentPage}</p>
                  <p><strong>Duration:</strong> {s.duration}s</p>
                  <p><strong>Journey:</strong> {s.journey.join(' → ')}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Recent Events</h3>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">No events yet.</p>
          ) : (
            <ul className="list-disc list-inside text-sm">
              {events.map((e, i) => (
                <li key={i}>
                  {e.type} on <strong>{e.page}</strong> from {e.country}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;


