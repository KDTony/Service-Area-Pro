
import json
import os
import urllib.request
import sys
import ssl

try:
    import numpy
except ImportError:
    print("numpy is not installed. Please install it using 'pip install numpy'")
    sys.exit(1)

try:
    from shapely.geometry import shape, mapping
except ImportError:
    print("shapely is not installed. Please install it using 'pip install shapely'")
    sys.exit(1)

STATES = {
    'AL': 'alabama', 'GA': 'georgia', 'TN': 'tennessee', 'MS': 'mississippi', 
    'FL': 'florida', 'SC': 'south-carolina', 'NC': 'north-carolina', 'VA': 'virginia', 
    'MO': 'missouri', 'IL': 'illinois', 'MN': 'minnesota', 'WI': 'wisconsin'
}
GEOJSON_BASE_URL = "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/"
SIMPLIFY_TOLERANCE = 0.005 # Adjust this for more/less detail

def download_and_process_state(state_code, state_name):
    """
    Downloads GeoJSON for a state, processes it, and saves a new centroids file with boundaries.
    """
    print(f"Processing {state_code}...")
    
    # 1. Download GeoJSON
    geojson_url = f"{GEOJSON_BASE_URL}{state_code.lower()}_{state_name.replace('-', '_')}_zip_codes_geo.min.json"
    geojson_filename = f"zipcode_data/{state_code}_bounds.json"
    try:
        # Create a non-verifying SSL context
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(geojson_url, context=context) as response, open(geojson_filename, 'wb') as out_file:
            data = response.read() # a `bytes` object
            out_file.write(data)
        print(f"  Downloaded {geojson_url}")
    except Exception as e:
        print(f"  ERROR: Could not download GeoJSON for {state_code}. Reason: {e}")
        return

    # 2. Load the downloaded GeoJSON
    with open(geojson_filename, 'r') as f:
        try:
            bounds_data = json.load(f)
        except json.JSONDecodeError:
            print(f"  ERROR: Could not parse GeoJSON for {state_code}. It may be invalid.")
            os.remove(geojson_filename)
            return

    # Create a lookup dictionary for zip code boundaries
    bounds_lookup = {
        feature['properties']['ZCTA5CE10']: feature['geometry']
        for feature in bounds_data.get('features', [])
    }
    
    # 3. Load the existing centroids data
    centroids_filename = f"zipcode_data/centroids_{state_code.lower()}.json"
    if not os.path.exists(centroids_filename):
        print(f"  ERROR: Centroids file not found: {centroids_filename}")
        os.remove(geojson_filename)
        return
        
    with open(centroids_filename, 'r') as f:
        centroids_data = json.load(f)

    # 4. Combine data and simplify boundaries
    new_centroids_data = {}
    for zip_code, details in centroids_data.items():
        new_details = details.copy()
        if zip_code in bounds_lookup:
            try:
                geom = shape(bounds_lookup[zip_code])
                # Simplify the geometry
                simplified_geom = geom.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
                # Ensure it's a simple polygon, not a multipolygon for this use case
                if simplified_geom.geom_type == 'Polygon':
                    # Convert back to GeoJSON format and get coordinates
                    new_details['boundary'] = mapping(simplified_geom)['coordinates'][0]
                elif simplified_geom.geom_type == 'MultiPolygon':
                     # Take the largest polygon
                    largest_poly = max(simplified_geom.geoms, key=lambda p: p.area)
                    new_details['boundary'] = mapping(largest_poly)['coordinates'][0]
            except Exception as e:
                print(f"  WARNING: Could not process geometry for zip {zip_code}. Reason: {e}")
                new_details['boundary'] = None
        else:
            new_details['boundary'] = None
            
        new_centroids_data[zip_code] = new_details

    # 5. Save the new data file
    output_filename = f"zipcode_data/centroids_with_bounds_{state_code.lower()}.json"
    with open(output_filename, 'w') as f:
        json.dump(new_centroids_data, f, separators=(',', ':')) # Compact JSON
    print(f"  Successfully created {output_filename}")
    
    # 6. Clean up downloaded file
    os.remove(geojson_filename)
    print(f"  Cleaned up {geojson_filename}")


if __name__ == "__main__":
    if not os.path.exists('zipcode_data'):
        os.makedirs('zipcode_data')
        
    for state_code, state_name in STATES.items():
        download_and_process_state(state_code, state_name)
    
    print("\nAll states processed.")

