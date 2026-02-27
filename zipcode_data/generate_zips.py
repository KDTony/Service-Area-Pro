import pgeocode
import json

# Ridgeline's 12 States
ridgeline_states = {
    "AL": "Alabama", "GA": "Georgia", "TN": "Tennessee", "MS": "Mississippi", 
    "FL": "Florida", "SC": "South Carolina", "NC": "North Carolina", 
    "VA": "Virginia", "MO": "Missouri", "IL": "Illinois", 
    "MN": "Minnesota", "WI": "Wisconsin"
}

# Initialize the US database (this may take a moment to download the first time)
nomi = pgeocode.Nominatim('us')

def generate_ridgeline_data():
    print("### Ridgeline Data Generation Started ###")
    
    # We will generate a wide range of zip codes to ensure we capture all active ones.
    # The library handles filtering the valid ones for us.
    for abbr, name in ridgeline_states.items():
        print(f"Gathering data for {name}...")
        
        # We query by state abbreviation. 
        # This returns a massive table of all zip codes in that state.
        state_data_full = nomi.query_postal_code("") # Get the full US set
        
        # Filter for just this state
        # In pgeocode, the column is 'state_code'
        # We pull the internal dataframe and filter it
        df = nomi._data
        state_df = df[df['state_code'] == abbr]
        
        state_json = {}
        for _, row in state_df.iterrows():
            # Clean up the data: Ensure zip is 5 digits and coords are numbers
            zip_code = str(row['postal_code']).zfill(5)
            state_json[zip_code] = {
                "lat": float(row['latitude']),
                "lng": float(row['longitude']),
                "city": str(row['place_name'])
            }
        
        filename = f"centroids_{abbr.lower()}.json"
        with open(filename, 'w') as f:
            json.dump(state_json, f, indent=2)
            
        print(f"✅ Saved {len(state_json)} zip codes to {filename}")

    print("\n🎉 Success! All 12 Ridgeline state files are ready in your folder.")

if __name__ == "__main__":
    generate_ridgeline_data()