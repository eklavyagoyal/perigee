"""Tool schemas for the OpenAI API tool-use loop (function-calling format)."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_huggingface_datasets",
            "description": (
                "Search HuggingFace Hub for open time-series datasets. "
                "Returns dataset name, URL, tags, and description excerpt."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query, e.g. 'wind turbine SCADA sensor anomaly'",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (default 10)",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_zenodo",
            "description": (
                "Search Zenodo open research repository for time-series datasets. "
                "Returns title, DOI, URL, description, file size, and a sample file URL if available."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query, e.g. 'wind farm SCADA failure prediction'",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results (default 8)",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_nasa_datasets",
            "description": (
                "Search NASA Open Data Portal and return curated space/satellite datasets "
                "including spacecraft anomaly telemetry, exoplanet light curves, and solar flux. "
                "Always returns the curated catalog; also queries the NASA API."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query, e.g. 'satellite telemetry anomaly spacecraft'",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "validate_dataset_url",
            "description": (
                "HTTP HEAD check on a dataset URL. Returns whether it is accessible, "
                "the file size in MB, and the content type. Use before downloading samples."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Direct URL to a dataset file or landing page",
                    },
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "probe_temporal_structure",
            "description": (
                "Download the first 32KB of a dataset file and check the two core rules: "
                "(1) has a time/timestamp column or regular index, "
                "(2) has an annotation/label/anomaly column. "
                "Returns column names, is_timeseries flag, has_annotations flag, and 3 sample rows."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Direct URL to a CSV, JSON, or gzipped CSV file",
                    },
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "score_dataset",
            "description": (
                "Score a candidate dataset on the evaluation rubric (0-10 per criterion). "
                "Returns a weighted total score and per-criterion breakdown. "
                "Use this after probing temporal structure."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Dataset name"},
                    "domain": {
                        "type": "string",
                        "description": "Domain: wind_turbine | mental_health | traffic | space_anomaly | space_observation",
                    },
                    "has_labels": {
                        "type": "boolean",
                        "description": "Confirmed annotation/label column exists",
                    },
                    "is_timeseries": {
                        "type": "boolean",
                        "description": "Confirmed timestamp or regular time index exists",
                    },
                    "license": {
                        "type": "string",
                        "description": "License string, e.g. 'CC-BY-4.0', 'NASA Open', 'MIT'",
                    },
                    "size_mb": {
                        "type": "number",
                        "description": "Dataset size in MB",
                    },
                    "cot_notes": {
                        "type": "string",
                        "description": "Brief note on why CoT reasoning is natural for this dataset",
                    },
                    "in_tsgym_corpus": {
                        "type": "boolean",
                        "description": "True if this dataset is already in the ts-gym corpus",
                    },
                },
                "required": ["name", "domain", "has_labels", "is_timeseries", "license", "size_mb", "cot_notes"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_problem_statement",
            "description": (
                "Generate a problem statement, user story, a sample chain-of-thought reasoning example, "
                "and the recommended TimeNet/OpenTSLM task type for a given dataset. "
                "Call this only for the top-5 scored candidates."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Dataset name"},
                    "domain": {"type": "string"},
                    "signals": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of sensor/signal channel names",
                    },
                    "label_type": {
                        "type": "string",
                        "description": "What the labels represent, e.g. 'anomaly spans', 'RUL', 'activity class'",
                    },
                    "score": {
                        "type": "number",
                        "description": "Dataset's total score from score_dataset",
                    },
                },
                "required": ["name", "domain", "signals", "label_type", "score"],
            },
        },
    },
]
