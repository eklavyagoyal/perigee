# ts-gym time-series corpora

One entry per loader in `ts_gym/corpora/` (plus the HEARTS pack), with the source each one downloads from. All are open unless noted.

## Cardiology (ECG)

- **MIT-BIH Arrhythmia Database (`mitdb`)** — 48 half-hour two-lead ambulatory ECGs at 360 Hz, every beat annotated by two cardiologists (~110k beats, 15 classes, plus rhythm spans). https://physionet.org/content/mitdb/ (fetched from `physionet-open.s3.amazonaws.com/mitdb/1.0.0`)
- **MIT-BIH Atrial Fibrillation Database (`afdb`)** — 25 ten-hour two-channel Holter ECGs at 250 Hz with audited rhythm annotations marking every AF/flutter/junctional episode. https://physionet.org/content/afdb/
- **MIT-BIH Noise Stress Test Database (`nstdb`)** — records 118/119 remade with calibrated electrode-motion noise at SNRs from 24 dB to −6 dB, plus the three pure-noise source recordings; beat annotations stay exact. https://physionet.org/files/nstdb/1.0.0
- **PTB-XL (`ptbxl`, `ptbxl12`)** — clinical 12-lead ECGs with SCP-ECG statement codes; loaded locally from the ECG-QA benchmark's export (lead-II-only and full 12-lead variants). Canonical source: https://physionet.org/content/ptb-xl/
- **LUDB (`ludb`)** — 200 ten-second 12-lead resting ECGs at 500 Hz with per-lead cardiologist delineation of every P/QRS/T wave. https://physionet.org/content/ludb/
- **PERG-IOBA (`perg`)** — 336 clinical pattern electroretinogram sessions (both eyes, µV) with retinal/optic-nerve diagnoses. https://physionet.org/content/perg-ioba-dataset/

## Clinical / ICU / surgery

- **VitalDB (`vitaldb`)** — intra-operative vitals of surgical cases: 500 Hz waveforms plus one-second monitor numerics, with full clinical sheets. https://vitaldb.net (API: `api.vitaldb.net`; open for research)
- **PhysioNet/CinC Challenge 2012 (`cinc2012`)** — first 48 ICU hours of set-a patients on a one-minute grid, 37 parameters, in-hospital-mortality labels. https://physionet.org/content/challenge-2012/
- **PhysioNet/CinC Challenge 2019 (`cinc2019`)** — hourly ICU vitals and labs per stay, sepsis-onset labels (marked six hours pre-onset). https://physionet.org/content/challenge-2019/

## EEG / sleep / eyes

- **CHB-MIT Scalp EEG (`chbmit`)** — pediatric epilepsy monitoring, hour-long 23-channel EDFs at 256 Hz with clinician seizure spans. https://physionet.org/content/chbmit/
- **Siena Scalp EEG (`siena`)** — adult focal epilepsy sessions at 512 Hz with wall-clock-timed seizure annotations and localization labels. https://physionet.org/content/siena-scalp-eeg/
- **Sleep-EDF Expanded (`sleep_edf`)** — whole-night polysomnograms (78 healthy cassette subjects + temazepam telemetry study) with 30-second R&K hypnograms. https://physionet.org/content/sleep-edfx/
- **CAP Sleep Database (`cap`)** — full polysomnograms of sleep pathologies scored for sleep stages and the cyclic alternating pattern (A1/A2/A3 phases). https://physionet.org/content/capslpdb/
- **Nakanishi 2015 SSVEP (`ssvep`)** — 8-channel occipital EEG at 256 Hz while subjects gaze at 12 flicker frequencies (9.25–14.75 Hz). https://github.com/mnakanishi/12JFPM_SSVEP
- **GazeBase (`gazebase`)** — 1 kHz monocular eye tracking through fixation, saccade, reading, video and gaming tasks, 322 subjects. https://figshare.com/articles/dataset/GazeBase_Data_Repository/12912257

## Wearables / human activity

- **WESAD (`wesad`)** — chest RespiBAN (700 Hz) and wrist Empatica E4 through a scripted stress protocol (baseline / TSST / amusement / meditation), condition spans as ground truth. https://ubicomp.eti.uni-siegen.de/home/datasets/icmi18/ (archive: `uni-siegen.sciebo.de`)
- **PAMAP2 (`pamap2`)** — three body-worn IMUs plus heart rate through scripted everyday and sport activities. https://archive.ics.uci.edu/dataset/231/pamap2+physical+activity+monitoring
- **Capture-24 (`capture24`)** — multi-day free-living wrist accelerometry at 100 Hz with fine-grained activity annotations; loaded from a local HF mirror (`nz00shuuuu/capture24-raw`). Canonical: https://ora.ox.ac.uk/objects/uuid:99d7c092-d865-4a19-b096-cc16440cd001
- **Daphnet Freezing of Gait (`daphnet`)** — ankle/thigh/trunk accelerometry of ten Parkinson's patients with video-marked freezing episodes. https://archive.ics.uci.edu/dataset/245/daphnet+freezing+of+gait
- **GrabMyo (`grabmyo`)** — 28-channel forearm/wrist surface EMG, 43 participants × 17 hand gestures × 3 sessions. https://physionet.org/content/grabmyo/
- **Harespod (`harespod`)** — respiration and pulse oximetry through a simulated hypobaric-chamber ascent from 1,500 m to 4,000 m, 15 subjects. https://doi.org/10.6084/m9.figshare.c.6467535 (archive on figshare)

## Glucose / metabolism

- **CGMacros (`cgmacros`)** — ten days per participant of dual CGM, Fitbit activity and photographed, macro-annotated meals on a one-minute grid. https://physionet.org/content/cgmacros/
- **Shanghai T1DM/T2DM (`shanghai`)** — 3–14-day hospital CGM visits (15-minute grid) with insulin, meals and full clinical metadata. https://figshare.com/articles/dataset/Diabetes_Datasets-ShanghaiT1DM_and_ShanghaiT2DM/20444397

## Industry / machines / infrastructure

- **CWRU Bearing Data (`cwru`)** — the reference machine-fault corpus: 12 kHz motor vibration with EDM-seeded bearing faults of known element and size. https://engineering.case.edu/bearingdatacenter
- **NASA C-MAPSS (`cmapss`)** — simulated turbofan fleets run to failure, one sample per flight cycle, 21 health sensors; remaining-useful-life ground truth. https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/ (zip: `phm-datasets.s3.amazonaws.com`)
- **SMD, Server Machine Dataset (`smd`)** — five weeks of one-minute datacenter telemetry (38 metrics × 28 machines) with operator-marked anomaly spans and contributing metrics. https://github.com/NetManAIOps/OmniAnomaly
- **NAB, Numenta Anomaly Benchmark (`nab`)** — 58 labelled single-channel anomaly streams: AWS metrics, ad rates, traffic, tweets, industrial temperatures. https://github.com/numenta/NAB
- **UK-DALE (`ukdale`)** — whole-house UK electricity aggregate against per-appliance submeters on a six-second grid. https://jack-kelly.com/data/ (archive at UK Energy Data Centre, `dap.ceda.ac.uk`)
- **Building Data Genome 2 (`bdg2`)** — two years of hourly meters (electricity, gas, water, steam, …) for non-residential buildings with site weather. https://github.com/buds-lab/building-data-genome-project-2
- **Gas sensor array under dynamic gas mixtures (`gasmix`)** — sixteen metal-oxide sensors at 100 Hz while ethylene is mixed with CO or methane at stepping set points. https://archive.ics.uci.edu/dataset/322/gas+sensor+array+under+dynamic+gas+mixtures

## Earth, sky and space

- **GHCN-daily (`ghcn`)** — century-plus daily weather at fourteen climate-diverse stations (Death Valley to Verkhoyansk). https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily
- **USGS river gauges (`usgswater`)** — two years of 15-minute streamflow and gage height at major gauges, with official NWS flood-stage spans. https://waterservices.usgs.gov (stages from `api.water.noaa.gov`)
- **Global earthquakes (`earthquakes`)** — 40-minute broadband seismograms from four GSN stations for every M6.8+ event of a pinned year, USGS catalog as ground truth. https://earthquake.usgs.gov + https://service.earthscope.org
- **NGL GNSS daily positions (`gnss`)** — millimetre-level daily east/north/up at eleven stations chosen for their geophysics (Tohoku, Maule, Cascadia slow slip, …). http://geodesy.unr.edu
- **Space weather (`spaceweather`)** — Kp/ap since 1932 (GFZ), monthly sunspots since 1749 and F10.7 radio flux (NOAA SWPC), with G-storm spans. https://kp.gfz.de + https://services.swpc.noaa.gov
- **GWOSC GWTC-1 (`gwosc`)** — the eleven confident LIGO/Virgo detections of O1/O2 as 32 s of 4096 Hz calibrated strain per detector. https://gwosc.org
- **ASAS-SN variable stars (`asassn`)** — years-long V-band light curves on a daily grid with expert variable-star classifications. https://asas-sn.osu.edu
- **ZTF periodic variables (`ztf`)** — two-color (g/r) light curves of stars from the Chen et al. periodic-variable catalog. https://irsa.ipac.caltech.edu (catalog via VizieR TAP)

## Ecology / agriculture / movement

- **BreizhCrops (`breizhcrops`)** — a growing season of Sentinel-2 spectra (13 bands) per Brittany field parcel, crop-registry labels. https://github.com/dl4sits/BreizhCrops (archive: `breizhcrops.s3.eu-central-1.amazonaws.com`)
- **Movebank biologging (`movebank`)** — GPS tracks of four species that move very differently: waved albatrosses, white storks, common cuckoos, Arctic foxes. https://datarepository.movebank.org
- **MarineCadastre AIS (`ais`)** — one pinned day (2023-06-15) of US coastal vessel traffic, 30 ships across six classes, position/speed/course per minute. https://marinecadastre.gov/ais/ (zip from `coast.noaa.gov`)

## Society / economy / epidemiology

- **FRED macro series (`fred`)** — headline US indicators (unemployment, CPI, payrolls, rates, …) with NBER recession spans. https://fred.stlouisfed.org
- **FluView ILINet (`fluview`)** — three decades of weekly US influenza-like-illness surveillance, national plus ten HHS regions. https://cmu-delphi.github.io/delphi-epidata/ (API: `api.delphi.cmu.edu`)
- **Wikipedia pageviews (`wikiviews`)** — ten years of daily readership of twenty signature articles (Christmas, Bitcoin, Influenza, …), desktop/mobile split. https://wikimedia.org/api/rest_v1/metrics/pageviews/

## Benchmark pack

- **HEARTS (`ts_gym_hearts`)** — ported exercises from the HEARTS benchmark (frozen data + scoring per task), drawing on CGMacros, Harespod and exercise data. https://huggingface.co/datasets/yang-ai-lab/HEARTS
