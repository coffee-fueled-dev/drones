FROM graphstack/dozerdb:5.26.3.0

# Set environment variables as needed
ENV NEO4J_PLUGINS='["apoc", "genai", "apoc-extended"]' \
    NEO4J_apoc_export_file_enabled=true \
    NEO4J_apoc_import_file_enabled=true \
    NEO4J_apoc_trigger_enabled=true \
    NEO4J_apoc_trigger_refresh=60000 \
    NEO4J_dbms_security_procedures_unrestricted='*' \
    NEO4J_server_memory_pagecache_size=1000M \
    NEO4J_server_memory_heap_max__size=1000M

# Expose necessary ports
EXPOSE 7474 7687

CMD ["neo4j", "console"]