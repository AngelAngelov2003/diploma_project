import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { FaFish, FaChartBar, FaThermometerHalf, FaMoon, FaExclamationTriangle, FaLock, FaUserPlus } from 'react-icons/fa';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const API_BASE_URL = 'http://localhost:5000';

function FishingMap() {
  const [waterBodies, setWaterBodies] = useState([]);
  const [forecasts, setForecasts] = useState({}); 
  const [loadingStatus, setLoadingStatus] = useState({});
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/water-bodies`)
      .then(res => setWaterBodies(res.data))
      .catch(err => setServerError("No connection to server (Backend)"));
  }, []);

  const getForecast = (id, lat, lng) => {
    setLoadingStatus(prev => ({ ...prev, [id]: true }));
    
    axios.get(`${API_BASE_URL}/forecast/${lat}/${lng}`)
      .then(res => {
        setForecasts(prev => ({ ...prev, [id]: res.data }));
        setLoadingStatus(prev => ({ ...prev, [id]: false }));
      })
      .catch(err => {
        alert("Error fetching forecast!");
        setLoadingStatus(prev => ({ ...prev, [id]: false }));
      });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', width: '100%' }}>
      <div style={{ width: '350px', background: 'white', overflowY: 'auto', boxShadow: '2px 0 5px rgba(0,0,0,0.2)', zIndex: 1000 }}>
        <div style={{ padding: '20px', background: '#007bff', color: 'white' }}>
          <h2><FaFish style={{ marginRight: '10px' }} /> Fishing Atlas</h2>
        </div>
        {serverError && <div style={{ padding: '15px', color: 'red', background: '#ffe6e6' }}><FaExclamationTriangle /> {serverError}</div>}
        <div>
          {waterBodies.map(lake => (
            <div key={lake.id} style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
              <strong>{lake.name}</strong>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <MapContainer center={[42.7339, 25.4858]} zoom={7} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='Tiles &copy; Esri' />
          
          {waterBodies.map(lake => {
            const lakeForecast = forecasts[lake.id];
            const isLoading = loadingStatus[lake.id];

            return (
              <React.Fragment key={lake.id}>
                <Marker position={[lake.lat, lake.lng]}>
                  <Popup>
                    <div style={{ textAlign: 'center', minWidth: '220px' }}>
                      <h3>{lake.name}</h3>
                      <p>{lake.description}</p>
                      
                      {!lakeForecast && (
                        <button 
                          onClick={() => getForecast(lake.id, lake.lat, lake.lng)}
                          disabled={isLoading}
                          style={{ 
                            background: isLoading ? '#ccc' : '#28a745', 
                            color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' 
                          }}
                        >
                          {isLoading ? "Loading..." : "Check Forecast & Luck"}
                        </button>
                      )}

                      {lakeForecast && !isLoading && (
                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginTop: '10px', border: '1px solid #ddd', fontSize: '14px' }}>
                          
                          <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#333' }}>
                            <FaChartBar /> Success Analysis
                          </h4>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span><FaThermometerHalf /> Weather:</span>
                            <strong>{lakeForecast.breakdown?.weather_score || '?'} / 100</strong>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span><FaMoon /> Moon ({lakeForecast.breakdown?.moon_phase}%):</span>
                            <strong>{lakeForecast.breakdown?.moon_score || '?'} / 100</strong>
                          </div>

                          <hr style={{ margin: '10px 0', borderTop: '1px solid #ccc' }} />

                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#666' }}>TOTAL INDEX (AI Forecast):</span>
                            <div style={{ 
                              fontSize: '24px', 
                              fontWeight: 'bold', 
                              color: lakeForecast.total_score > 60 ? '#28a745' : (lakeForecast.total_score < 40 ? '#dc3545' : '#ffc107'),
                              marginTop: '5px'
                            }}>
                              {lakeForecast.total_score} / 100
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>

                {lake.boundary && <Polygon positions={lake.boundary} pathOptions={{ color: 'blue', fillColor: '#00aaff', fillOpacity: 0.4 }} />}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

const Login = () => (
  <div style={{ padding: '20px' }}>
    <h2><FaLock /> Login</h2>
    <p>JWT Authentication form will be here (Section 8.5).</p>
  </div>
);

const Register = () => (
  <div style={{ padding: '20px' }}>
    <h2><FaUserPlus /> Register</h2>
    <p>Form for new users (User/Owner).</p>
  </div>
);

const Dashboard = () => (
  <div style={{ padding: '20px' }}>
    <h2><FaChartBar /> Admin/User Dashboard</h2>
    <p>Statistics, reservation management, and subscriptions (Section 5.3).</p>
  </div>
);

const Navigation = () => (
  <nav style={{ height: '60px', background: '#343a40', display: 'flex', alignItems: 'center', padding: '0 20px', color: 'white' }}>
    <h1 style={{ fontSize: '20px', marginRight: 'auto', display: 'flex', alignItems: 'center' }}><FaFish style={{ marginRight: '10px' }} /> Fishing Atlas AI</h1>
    <div style={{ display: 'flex', gap: '15px' }}>
      <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Map</Link>
      <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none' }}>Dashboard</Link>
      <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
    </div>
  </nav>
);

function App() {
  return (
    <Router>
      <Navigation />
      <Routes>
        <Route path="/" element={<FishingMap />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;