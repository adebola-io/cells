#!/bin/bash

# Find all .js files in the dist directory
find dist -type f -name "*.js" | while read -r jsfile; do
  # Get the base name of the file (e.g., index.js)
  base_name=$(basename "$jsfile")
  # Construct the corresponding .d.ts filename (e.g., index.d.ts)
  dts_file="${base_name%.js}.d.ts"
  # Construct the reference comment
  reference_comment="/// <reference types=\"./$dts_file\" />"

  # Check if the reference comment already exists
  if ! grep -qF "$reference_comment" "$jsfile"; then
    # Prepend the reference comment to the file
    echo "$reference_comment" | cat - "$jsfile" > temp_file && mv temp_file "$jsfile"
  fi
done

echo "Finished adding references."
