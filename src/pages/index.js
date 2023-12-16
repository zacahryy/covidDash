import React, { useRef, useEffect, Component } from "react";
import PropTypes from "prop-types";
import { Helmet } from "react-helmet";
import L from "leaflet";
import { Marker, useMap } from "react-leaflet";

import { promiseToFlyTo, getCurrentLocation } from "lib/map";

import Layout from "components/Layout";
import Container from "components/Container";
import Map from "components/Map";

import axios from 'axios';

const LOCATION = { lat: 0, lng: 0 };   // middle of the world
  // { lat: 38.9072, lng: -77.0369 };  // in Los Angeles

  const CENTER = [LOCATION.lat, LOCATION.lng];
const DEFAULT_ZOOM = 2;
const ZOOM = 10;

const timeToZoom = 2000;

function countryPointToLayer (feature = {}, latlng) { 
  const { properties = {} } = feature;
  let updatedFormatted;
  let casesString;

  const {
    country,
    updated,
    cases, 
    deaths,
    recovered
  } = properties;

  casesString = `${cases}`;

  if      (cases > 1000000) { casesString = `${casesString.slice(0, -6)}M+`; }
  else if (cases > 1000)    { casesString = `${casesString.slice(0, -3)}k+`;  }
  
  if (updated)      { updatedFormatted = new Date(updated).toLocaleString(); }

  const html = `
    <span class="icon-marker">
      <span class="icon-marker-tooltip">
        <h2>${country}</h2>
        <ul>
          <li><strong>Confirmed:</strong> ${cases}</li>
          <li><strong>Deaths:</strong> ${deaths}</li>
          <li><strong>Recovered:</strong> ${recovered}</li>
          <li><strong>Last Update:</strong> ${updatedFormatted}</li>
        </ul>
      </span>
      ${casesString} 
    </span>
  `;

  return L.marker(latlng, {
    icon: L.divIcon({
      className: 'icon',
      html
    }),
    riseOnHover: true
  });
}

const MapEffect = ({ markerRef }) => {
  console.log('in MapEffect...');
  const map = useMap();

  useEffect(() => {
    if (!markerRef.current || !map) return;

    (async function run() {
      console.log('about to call axios to get the data...');

      // const options = {
      //   method: 'GET',
      //   url: 'https://api.api-ninjas.com/v1/covid19',
      //   // params: {country: 'China'},    // for one country -- if blank will get all countries
      //   headers: {
      //     'X-API-Key': 'Vx489MBLcso/FNugQeMLNw==7tSBYITt1WeQkCTu',
      //     'X-API-Host': 'api.api-ninjas.com'
      //   }
      // };


      const options = {
        method: 'GET',
        url: 'https://disease.sh/v3/covid-19/countries',
        // params: {country: 'China'},    // for one country -- if blank will get all countries
        // headers: {
        //   'Disease.sh': 'disease.sh'
        // }
      };
      
      let response; 
      
      try { response = await axios.request(options); 
      } catch (error) { 
        console.error(error);  
        return; 
      }
      console.log(response.data);
      // const rdr = response.data.response;    // for rapidapi
      // const data = rdr;

      const data = response.data;     // for disease.sh
      const hasData = Array.isArray(data) && data.length > 0;
      if (!Array.isArray(data)) { console.log('not an array!'); return; }
      if (data.length === 0) { console.log('data length is === 0'); }

      if (!hasData) { console.log('No data, sorry!');  return; }

      const geoJson = {
        type: 'FeatureCollection',
        features: data.map((country = {}) => {
          const {countryInfo = {} } = country;
          const { lat, long: lng } = countryInfo;
          return {
            type: 'Feature',
            properties: {
              ...country,
            },
            geometry: {
              type: 'Point',
              coordinates: [ lng, lat]
            }
          }
        })
      }

      console.log('geoJson', geoJson);

      const geoJsonLayers = new L.GeoJSON(geoJson, { 
        pointToLayer: countryPointToLayer
      });
      var _map = markerRef.current._map;
      geoJsonLayers.addTo(_map);

      const location = await getCurrentLocation().catch(() => LOCATION);

      setTimeout(async () => {
        await promiseToFlyTo(map, { zoom: ZOOM, center: location, });
      }, timeToZoom);
    })();
  }, [map, markerRef]);

  return null;
};

MapEffect.propTypes = {
  markerRef: PropTypes.object,
};

class IndexPage extends Component {
  constructor(props) {
    super(props);

    this.markerRef = React.createRef(); // Initialize markerRef

    this.state = {
      statistics: [
        { label: 'Global Deaths', key: 'globalDeaths', color: '#FF0000' }, // Red
        { label: 'Global Cases', key: 'globalCases', color: '#00FF00' }, // Green
        { label: 'Global Recovered', key: 'globalRecovered', color: '#0000FF' }, // Blue
        { label: 'Global Fatal', key: 'globalFatal', color: '#FFA500' }, // Orange
        { label: 'Global Daily Cases', key: 'globalDailyCases', color: '#800080' }, // Purple
      ],
      currentIndex: 0,
      globalDeaths: null,
      globalCases: null,
      globalRecovered: null,
      globalFatal: null,
      globalDailyCases: null,
    };
  }

  componentDidMount() {
    // Fetch global COVID-19 data to get various statistics
    this.fetchGlobalStatistics();

    // Set up interval to rotate statistics every 5 seconds
    this.interval = setInterval(() => {
      this.rotateStatistics();
    }, 5000);
  }

  componentWillUnmount() {
    // Clear the interval to avoid memory leaks
    clearInterval(this.interval);
  }

  fetchGlobalStatistics() {
    axios
      .get('https://disease.sh/v3/covid-19/all')
      .then(response => {
        const {
          deaths,
          cases,
          recovered,
          todayCases,
          todayDeaths,
        } = response.data;

        this.setState({
          globalDeaths: deaths,
          globalCases: cases,
          globalRecovered: recovered,
          globalFatal: deaths, // Assuming deaths as fatal cases for simplicity
          globalDailyCases: todayCases,
        });
      })
      .catch(error => {
        console.error('Error fetching global data:', error);
      });
  }

  rotateStatistics() {
    const { statistics, currentIndex } = this.state;
    const newIndex = (currentIndex + 1) % statistics.length;

    // Fetch new data when rotating to a new statistic
    this.fetchGlobalStatistics();

    this.setState({
      currentIndex: newIndex,
    });
  }

  switchStatistic(index) {
    // Manually switch to the selected statistic
    this.setState({
      currentIndex: index,
    });
  }

  render() {
    const { statistics, currentIndex } = this.state;
    const currentStatistic = statistics[currentIndex];
    const currentValue = this.state[currentStatistic.key];

    const mapSettings = {
      center: CENTER,
      defaultBaseMap: 'OpenStreetMap',
      zoom: DEFAULT_ZOOM,
    };

    return (
      <Layout pageName="home">
        <Helmet>
          <title>Home Page</title>
        </Helmet>

        {/* Display current statistic with fade transition */}
        <Container
          type="content"
          className="text-center global-statistics-box"
          style={{ color: currentStatistic.color, transition: 'color 0.5s' }}
        >
          <div className="global-statistic">
            <h3>{currentStatistic.label}</h3>
            <p>{currentValue !== null ? currentValue.toLocaleString() : 'Loading...'}</p>
          </div>
        </Container>

        {/* Buttons to switch between statistics */}
        <Container type="content" className="text-center global-buttons">
          {statistics.map((statistic, index) => (
            <button
              key={index}
              className={index === currentIndex ? 'active' : ''}
              onClick={() => this.switchStatistic(index)}
            >
              {statistic.label}
            </button>
          ))}
        </Container>

        <Map {...mapSettings}>
          <MapEffect markerRef={this.markerRef} />
          <Marker ref={this.markerRef} position={CENTER} />
        </Map>

        <Container type="content" className="text-center home-start">
          <h2>CSUF CPSC 349-01 COVID-19 Dashboard</h2>
          <h6>All data sourced from: https://disease.sh/</h6>
        </Container>
      </Layout>
    );
  }
}

export default IndexPage;




