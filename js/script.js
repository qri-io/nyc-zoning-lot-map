// this is my mapboxGL token
// the base style includes data provided by mapbox, this links the requests to my account
mapboxgl.accessToken = 'pk.eyJ1IjoiY3dob25nLXFyaSIsImEiOiJjazZncWRkZGowb3kyM25vZXkwbms2cW0xIn0.lbwola6y7YDdaKLMdjif1g';

// we want to return to this point and zoom level after the user interacts
// with the map, so store them in variables
var initialCenterPoint = [-73.991780, 40.676]
var initialZoom = 13

// create an object to hold the initialization options for a mapboxGL map
var initOptions = {
  container: 'map-container', // put the map in this container
  style: 'mapbox://styles/mapbox/light-v10', // use this basemap
  center: initialCenterPoint, // initial view center
  zoom: initialZoom, // initial view zoom level (0-18)
}

// create the new map
var map = new mapboxgl.Map(initOptions);

// add zoom and rotation controls to the map.
map.addControl(new mapboxgl.NavigationControl());

map.addControl(
  new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl
  })
)

const customLayerSetup = (ZoningLotsFC) => {
  map.addSource('nyc-zoning-lots', {
    type: 'geojson',
    data: ZoningLotsFC
  })

  // add a layer for the highlighted lot
  map.addLayer({
    id: 'nyc-zoning-lots-fill',
    type: 'fill',
    source: 'nyc-zoning-lots',
    paint: {
      'fill-opacity': 0.9,
      'fill-color': 'steelblue',
    }
  });

  // add an empty data source, which we will use to highlight the lot the user is hovering over
  map.addSource('highlight-feature', {
    type: 'geojson',
    data: {
     type: 'FeatureCollection',
     features: []
    }
  })

  // add a layer for the highlighted lot
  map.addLayer({
    id: 'highlight-line',
    type: 'line',
    source: 'highlight-feature',
    paint: {
     'line-width': 2,
     'line-opacity': 0.9,
     'line-color': 'orange',
    }
    });
}



// wait for the initial style to Load
map.on('style.load', function() {

  // load csv
  Papa.parse('data/nyc_zoning_lots.csv', {
	   download: true,
     header: true,
     complete: ({ data }) => {
       // transform to geojson
       const FC = {
         type: 'FeatureCollection',
         features: data.map((row) => {
           const geometry = wellknown.parse(row.geom)
           delete row.geom
           const properties = {
             ...row
           }
           return {
             geometry,
             properties,
           }
         })
       }
       customLayerSetup(FC)
     }
  })

  const createPopup = (feature) => {
    var popUps = document.getElementsByClassName('mapboxgl-popup');
    /** Check if there is already a popup on the map and if so, remove it */
    if (popUps[0]) popUps[0].remove();

    const centroid = turf.centroid(feature.geometry)

    var popup = new mapboxgl.Popup({ closeOnClick: false })
      .setLngLat(centroid.geometry.coordinates)
      .setHTML(feature.properties.certificate_doc_id)
      .addTo(map)
  }

  map.on('click', function (e) {
    const [ feature ] = map.queryRenderedFeatures(e.point, {
        layers: ['nyc-zoning-lots-fill'],
    });

    if (feature) {
      // fit to bounds of feature geometry
      const bounds = turf.bbox(feature.geometry)
      map.fitBounds(bounds, {
        padding: {
          top: 250,
          right: 100,
          bottom: 100,
          left: 100
        }
      })

      createPopup(feature)

      const document_id = feature.properties.certificate_doc_id
      $('#document-container').html(`
        <iframe src="https://a836-acris.nyc.gov/DS/DocumentSearch/DocumentImageView?doc_id=${document_id}" style="border:0px #ffffff none;" name="myiFrame" scrolling="yes" frameborder="1" marginheight="0px" marginwidth="0px" height="100%" width="100%" allowfullscreen></iframe>
      `)
    }
  })


  map.on('mousemove', function (e) {
    // query for the features under the mouse, but only in the lots layer
    var features = map.queryRenderedFeatures(e.point, {
        layers: ['nyc-zoning-lots-fill'],
    });

    // if the mouse pointer is over a feature on our layer of interest
    // take the data for that feature and display it in the sidebar
    if (features.length > 0) {
      map.getCanvas().style.cursor = 'pointer';  // make the cursor a pointer

      var hoveredFeature = features[0]
      map.getSource('highlight-feature').setData(hoveredFeature.geometry);
    } else {
      // if there is no feature under the mouse, reset things:
      map.getCanvas().style.cursor = 'default'; // make the cursor default

      // reset the highlight source to an empty featurecollection
      const highlightSource = map.getSource('highlight-feature')
      if (highlightSource) {
        highlightSource.setData({
          type: 'FeatureCollection',
          features: []
        });
      }

    }
  })
})
