mapboxgl.accessToken = 'pk.eyJ1IjoiY3dob25nLXFyaSIsImEiOiJjazZncWRkZGowb3kyM25vZXkwbms2cW0xIn0.lbwola6y7YDdaKLMdjif1g'

var initialCenterPoint = [-73.99397, 40.71232]
var initialZoom = 12.87

var initOptions = {
  container: 'map-container',
  style: 'mapbox://styles/mapbox/light-v10',
  center: initialCenterPoint,
  zoom: initialZoom,
  hash: true
}
// create the new map
var map = new mapboxgl.Map(initOptions)

// add zoom and rotation controls to the map.
map.addControl(new mapboxgl.NavigationControl())
map.addControl(new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl
}), 'top-left')
const EmptyFC = {
  type: 'FeatureCollection',
  features: []
}
const customLayerSetup = (ZoningLotsFC) => {
  map.addSource('nyc-zoning-lots', {
    type: 'geojson',
    data: ZoningLotsFC
  })
  map.addLayer({
    id: 'nyc-zoning-lots-fill',
    type: 'fill',
    source: 'nyc-zoning-lots',
    paint: {
      'fill-opacity': 0.9,
      'fill-color': 'steelblue',
    }
  }, 'building-outline')
  map.addLayer({
    id: 'nyc-zoning-lots-line',
    type: 'line',
    source: 'nyc-zoning-lots',
    paint: {
      'line-opacity': 1,
      'line-width': 2,
      'line-color': 'steelblue',
    }
  }, 'building-outline')
  // add an empty data source, which we will use to highlight the lot the user is hovering over
  map.addSource('highlight-feature', {
    type: 'geojson',
    data: EmptyFC
  })
  // add a layer for the highlighted lot
  map.addLayer({
    id: 'highlight-line',
    type: 'line',
    source: 'highlight-feature',
    paint: {
      'line-width': 4,
      'line-opacity': 0.7,
      'line-color': 'purple',
    }
  })
  // add an empty data source, which we will use to highlight the lot the user is hovering over
  map.addSource('selected-feature', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  })
  // add a layer for the highlighted lot
  map.addLayer({
    id: 'selected-line',
    type: 'line',
    source: 'selected-feature',
    paint: {
      'line-width': 4,
      'line-opacity': 0.9,
      'line-color': 'purple',
    }
  })
}
// wait for the initial style to Load
map.on('style.load', function() {
  map.setPaintProperty('building', 'fill-color', '#cccccc')
  map.setPaintProperty('building', 'fill-opacity', 0.2)
  // load csv
  Papa.parse('data/nyc_zoning_lots.csv', {
    download: true,
    header: true,
    complete: ({
      data
    }) => {
      // transform to geojson
      const FC = {
        type: 'FeatureCollection',
        features: data.map((row) => {
          const geometry = wellknown.parse(row.geom)
          delete row.geom
          const properties = { ...row
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
    var popUps = document.getElementsByClassName('mapboxgl-popup')
    /** Check if there is already a popup on the map and if so, remove it */
    if (popUps[0]) popUps[0].remove()
    const centroid = turf.centroid(feature.geometry)
    var popup = new mapboxgl.Popup({
      closeOnClick: false
    }).setLngLat(centroid.geometry.coordinates).setHTML(feature.properties.certificate_doc_id).addTo(map)
  }
  map.on('click', function(e) {
    const [feature] = map.queryRenderedFeatures(e.point, {
      layers: ['nyc-zoning-lots-fill'],
    })
    if (feature) {
      // fit to bounds of feature geometry
      const bounds = turf.bbox(feature.geometry)
      map.fitBounds(bounds, {
        padding: {
          top: 250,
          right: 250,
          bottom: 250,
          left: 250
        }
      })
      // createPopup(feature)
      // console.log(feature.properties)
      const {
        document_bbls,
        certificate_doc_id,
        pluto20v1_geom_match,
        document_date,
      } = feature.properties
      map.getSource('selected-feature').setData(turf.buffer(feature.geometry, .005))
      $('.close').on('click', () => {
        $('#zoning-lot-info').css('left', '100%')
        map.getSource('selected-feature').setData(EmptyFC)
      })
      const documentURL = `https://a836-acris.nyc.gov/DS/DocumentSearch/DocumentImageView?doc_id=${certificate_doc_id}`
      const bblLinks = document_bbls.split(';').map((bbl) => {
        const borough = bbl.substring(0, 1)
        const block = bbl.substring(1, 6)
        const lot = bbl.substring(6, 10)
        const url = `http://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${borough}&block=${block}&lot=${lot}`
        return `<a href='${url}' target='_blank'>${bbl}</a>`
      }).join(' ')
      const plutoMatchDisplay = pluto20v1_geom_match === 'all' ? 'Geometries were found for all tax lots associated with the document' : 'Geometries were found for only some tax lots associated with the document'
      $('#zoning-lot-info-content').html(`
          <div class='container'>
            <h3>Zoning Lot Details</h3>
            <dl class="row">
              <dt class="col-sm-4">Tax Lots</dt>
              <dd class="col-sm-8">${bblLinks}</dd>

              <dt class="col-sm-4">ACRIS Document</dt>
              <dd class="col-sm-8"><a href='${documentURL}' target='_blank'>${certificate_doc_id}</a></dd>

              <dt class="col-sm-4">Document Date</dt>
              <dd class="col-sm-8">${moment(document_date).format('MMMM Do, YYYY')}</dd>

              <dt class="col-sm-4">PLUTO 20v1 Match</dt>
              <dd class="col-sm-8">${plutoMatchDisplay}</dd>
            </dl>
            <h5>Browse ACRIS Document</h5>
          </div>
        <div id='document-container'>
        </div>
      `)
      $('#zoning-lot-info').css('left', '0')
      $('#document-container').html(`
        <iframe src="${documentURL}" style="border:0px #ffffff none" name="myiFrame" scrolling="yes" frameborder="1" marginheight="0px" marginwidth="0px" height="1029" width="100%" allowfullscreen></iframe>
      `)
    }
  })
  map.on('mousemove', function(e) {
    // query for the features under the mouse, but only in the lots layer
    var features = map.queryRenderedFeatures(e.point, {
      layers: ['nyc-zoning-lots-fill'],
    })
    // if the mouse pointer is over a feature on our layer of interest
    // take the data for that feature and display it in the sidebar
    if (features.length > 0) {
      map.getCanvas().style.cursor = 'pointer' // make the cursor a pointer
      var hoveredFeature = features[0]
      map.getSource('highlight-feature').setData(turf.buffer(hoveredFeature.geometry, .005))
    } else {
      // if there is no feature under the mouse, reset things:
      map.getCanvas().style.cursor = 'default' // make the cursor default
      // reset the highlight source to an empty featurecollection
      const highlightSource = map.getSource('highlight-feature')
      if (highlightSource) {
        highlightSource.setData(EmptyFC)
      }
    }
  })
})
