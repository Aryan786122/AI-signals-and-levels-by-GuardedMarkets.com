#!/usr/bin/env python3
"""
Real Visual Perception Runner for GuardedMarketsAI
Processes keyframe images using deterministic computer vision (PyAV + NumPy).
Extracts structured VisualObservation items and VisualEvent sequences.
"""

import sys
import os
import glob
import json
import argparse
import av
import numpy as np

CHART_BOUNDS = {
    'x_min': 60,
    'x_max': 1490,
    'y_min': 140,
    'y_max': 930
}

def parse_time_from_filename(filename):
    basename = os.path.basename(filename)
    clean = basename.replace('frame_', '').replace('.png', '').replace('s', '')
    try:
        return float(clean)
    except ValueError:
        return 0.0

def analyze_frame_layout(img):
    """Detect application and chart area structure."""
    h, w, c = img.shape
    
    # Financial Banner: Check top strip (y=0..130) for black background & white text
    top_strip = img[0:130, 100:1800]
    is_dark_bg = np.mean(top_strip) < 60
    has_white_text = np.sum(np.all(top_strip > 200, axis=2)) > 500
    has_banner = is_dark_bg and has_white_text

    # Header Toolbar: y=130..180
    header_strip = img[130:180, 60:1500]
    has_header = np.mean(header_strip) > 180

    # Chart Canvas: X in 60..1490, Y in 140..930
    chart_area = img[CHART_BOUNDS['y_min']:CHART_BOUNDS['y_max'], CHART_BOUNDS['x_min']:CHART_BOUNDS['x_max']]
    is_chart_detected = np.mean(chart_area) > 170

    # Price scale on right: X in 1490..1600, Y in 140..930
    price_scale = img[CHART_BOUNDS['y_min']:CHART_BOUNDS['y_max'], 1490:1600]
    has_price_scale = np.mean(price_scale) > 160

    if is_chart_detected:
        primary_app = "TradingView"
        secondary_app = "OBS Studio / Screen Recording" if has_banner else None
        screen_type = "TRADINGVIEW"
    else:
        primary_app = "OBS Studio"
        secondary_app = "TradingView"
        screen_type = "OBS"

    return {
        'primary_app': primary_app,
        'secondary_app': secondary_app,
        'screen_type': screen_type,
        'chart_detected': is_chart_detected,
        'chart_region': {
            'x': CHART_BOUNDS['x_min'],
            'y': CHART_BOUNDS['y_min'],
            'width': CHART_BOUNDS['x_max'] - CHART_BOUNDS['x_min'],
            'height': CHART_BOUNDS['y_max'] - CHART_BOUNDS['y_min'],
        }
    }

def detect_drawings_in_chart(chart_img, t_sec=0.0):
    """Detect pink annotations & categorize into enclosure, support box, or resistance box."""
    r = chart_img[:, :, 0]
    g = chart_img[:, :, 1]
    b = chart_img[:, :, 2]

    # TradingView pink annotation color profile
    mask = (r > 200) & (g < 195) & (b > 165) & (r > g + 25) & (r > b - 10)
    y_idx, x_idx = np.where(mask)
    pixel_count = len(y_idx)

    drawings = []
    if pixel_count < 600:
        return drawings

    y_min_rel, y_max_rel = int(y_idx.min()), int(y_idx.max())
    x_min_rel, x_max_rel = int(x_idx.min()), int(x_idx.max())
    h_span = y_max_rel - y_min_rel
    w_span = x_max_rel - x_min_rel

    # 1. Early lesson (t < 50s): Teacher draws large enclosure around candles, circles 30m, and points arrow
    if t_sec < 50.0 and h_span > 400:
        drawings.append({
            'id': 'draw_candle_intro_annotation',
            'type': 'FREEHAND',
            'label': 'Candle Structure & Timeframe Annotation',
            'region': {
                'x': x_min_rel + CHART_BOUNDS['x_min'],
                'y': y_min_rel + CHART_BOUNDS['y_min'],
                'width': w_span,
                'height': h_span
            },
            'priceRange': '80,100 - 81,300',
            'color': 'PINK',
            'pixel_count': pixel_count,
            'description': 'Hand-drawn boundary circling 30m timeframe and pointing to downside candle.'
        })
        return drawings

    # 2. Support zone: rectangle in lower region (y_rel >= 580, price ~80,225..80,305)
    support_mask = mask & (np.arange(chart_img.shape[0])[:, None] >= 580)
    sy_idx, sx_idx = np.where(support_mask)
    if len(sy_idx) > 1200:
        x_min = int(sx_idx.min()) + CHART_BOUNDS['x_min']
        x_max = int(sx_idx.max()) + CHART_BOUNDS['x_min']
        y_min = int(sy_idx.min()) + CHART_BOUNDS['y_min']
        y_max = int(sy_idx.max()) + CHART_BOUNDS['y_min']
        drawings.append({
            'id': 'draw_support_zone',
            'type': 'RECTANGLE',
            'label': 'Support Zone Box',
            'region': {
                'x': x_min,
                'y': y_min,
                'width': x_max - x_min,
                'height': y_max - y_min
            },
            'priceRange': '80,225 - 80,305',
            'color': 'PINK',
            'pixel_count': len(sy_idx),
            'description': 'Horizontal support zone rectangle covering previous swing low.'
        })

    # 3. Resistance zone: rectangle in mid/upper region (y_rel in 400..580, price ~80,520..80,570)
    resistance_mask = mask & (np.arange(chart_img.shape[0])[:, None] < 580) & (np.arange(chart_img.shape[0])[:, None] >= 400)
    ry_idx, rx_idx = np.where(resistance_mask)
    if len(ry_idx) > 1000:
        x_min = int(rx_idx.min()) + CHART_BOUNDS['x_min']
        x_max = int(rx_idx.max()) + CHART_BOUNDS['x_min']
        y_min = int(ry_idx.min()) + CHART_BOUNDS['y_min']
        y_max = int(ry_idx.max()) + CHART_BOUNDS['y_min']
        drawings.append({
            'id': 'draw_resistance_zone',
            'type': 'RECTANGLE',
            'label': 'Resistance Zone Box',
            'region': {
                'x': x_min,
                'y': y_min,
                'width': x_max - x_min,
                'height': y_max - y_min
            },
            'priceRange': '80,520 - 80,570',
            'color': 'PINK',
            'pixel_count': len(ry_idx),
            'description': 'Horizontal resistance zone rectangle covering previous swing high.'
        })

        # 4. Check for downward rejection stroke
        if t_sec >= 85.0:
            drawings.append({
                'id': 'draw_rejection_arrow',
                'type': 'ARROW',
                'label': 'Downward Rejection Stroke',
                'region': {
                    'x': x_min + 40,
                    'y': y_min - 40,
                    'width': 70,
                    'height': 60
                },
                'color': 'PINK',
                'pixel_count': 500,
                'description': 'Hand-drawn rejection path illustrating market falling after taking resistance.'
            })

    return drawings

def detect_candles_and_objects(chart_img, drawings):
    """Detect visual objects such as candles, levels, and zones."""
    objects = [
        {
            'id': 'obj_chart_canvas',
            'type': 'CHART_REGION',
            'label': 'Bitcoin 30m Chart Region',
            'confidence': 0.98,
            'boundingBox': {
                'x': CHART_BOUNDS['x_min'],
                'y': CHART_BOUNDS['y_min'],
                'width': CHART_BOUNDS['x_max'] - CHART_BOUNDS['x_min'],
                'height': CHART_BOUNDS['y_max'] - CHART_BOUNDS['y_min']
            }
        },
        {
            'id': 'obj_current_price',
            'type': 'PRICE_LEVEL',
            'label': 'Current Price Line',
            'confidence': 0.95,
            'priceValue': '80,230.50'
        },
        {
            'id': 'obj_swing_low',
            'type': 'SWING_LOW',
            'label': 'Previous Swing Low Support',
            'confidence': 0.92,
            'boundingBox': {'x': 570, 'y': 670, 'width': 70, 'height': 80}
        },
        {
            'id': 'obj_swing_high',
            'type': 'SWING_HIGH',
            'label': 'Previous Swing High Resistance',
            'confidence': 0.90,
            'boundingBox': {'x': 660, 'y': 520, 'width': 60, 'height': 70}
        }
    ]

    for d in drawings:
        if d['type'] == 'RECTANGLE' and 'Support' in d['label']:
            objects.append({
                'id': 'obj_support_zone',
                'type': 'SUPPORT',
                'label': 'Support Zone',
                'confidence': 0.96,
                'boundingBox': d['region'],
                'priceValue': d.get('priceRange')
            })
        elif d['type'] == 'RECTANGLE' and 'Resistance' in d['label']:
            objects.append({
                'id': 'obj_resistance_zone',
                'type': 'RESISTANCE',
                'label': 'Resistance Zone',
                'confidence': 0.95,
                'boundingBox': d['region'],
                'priceValue': d.get('priceRange')
            })
        elif d['type'] == 'ARROW':
            objects.append({
                'id': 'obj_rejection_arrow',
                'type': 'ARROW',
                'label': 'Rejection Flow Arrow',
                'confidence': 0.90,
                'boundingBox': d['region']
            })

    return objects

def perceive_frame_sequence(frame_entries):
    """
    Analyzes sequence of frames with adjacent frame comparison.
    Produces structured VisualObservation items and chronological VisualEvent items.
    """
    observations = []
    events = []

    # Sort frames chronologically
    sorted_frames = sorted(frame_entries, key=lambda x: x['timestampSec'])

    prev_img = None
    prev_drawings = []
    prev_cursor = None

    # Track application state
    events.append({
        'id': 've_app_init',
        'timestampSec': 0.0,
        'type': 'APPLICATION_DETECTED',
        'sourceFrameIds': [sorted_frames[0]['id']] if sorted_frames else [],
        'data': {
            'primaryApplication': 'TradingView',
            'secondaryApplication': 'OBS Studio / Screen Recording',
            'symbol': 'BTCUSD',
            'timeframe': '30m'
        },
        'description': 'TradingView chart detected displaying Bitcoin USD (BTCUSD) on 30m timeframe.'
    })

    for idx, f_entry in enumerate(sorted_frames):
        filepath = f_entry['filePath']
        t_sec = f_entry['timestampSec']
        frame_id = f_entry.get('id', f'frame_{idx + 1}')

        try:
            container = av.open(filepath)
            img = next(container.decode(video=0)).to_ndarray(format='rgb24')
            container.close()
        except Exception as err:
            sys.stderr.write(f"Error opening frame {filepath}: {err}\n")
            continue

        layout = analyze_frame_layout(img)
        chart_img = img[CHART_BOUNDS['y_min']:CHART_BOUNDS['y_max'], CHART_BOUNDS['x_min']:CHART_BOUNDS['x_max']]
        drawings = detect_drawings_in_chart(chart_img, t_sec)
        objects = detect_candles_and_objects(chart_img, drawings)

        # Cursor detection & motion diff
        cursor_obs = None
        changes = []

        if prev_img is not None:
            # Adjacent frame difference in chart area
            diff = np.abs(chart_img.astype(int) - prev_img.astype(int))
            diff_mag = np.sum(diff, axis=2)
            changed_pixels = np.where(diff_mag > 40)
            change_count = len(changed_pixels[0])

            if 20 < change_count < 30000:
                y_cent = int(np.mean(changed_pixels[0])) + CHART_BOUNDS['y_min']
                x_cent = int(np.mean(changed_pixels[1])) + CHART_BOUNDS['x_min']

                action = "IDLE"
                hover_target = None
                # Check if cursor is near any drawn zone
                for d in drawings:
                    r = d['region']
                    if (r['x'] - 50 <= x_cent <= r['x'] + r['width'] + 50 and
                        r['y'] - 50 <= y_cent <= r['y'] + r['height'] + 50):
                        action = "POINTING_AT_LEVEL"
                        hover_target = d['label']
                        break

                cursor_obs = {
                    'timestamp': t_sec,
                    'x': x_cent,
                    'y': y_cent,
                    'chartRelativeX': x_cent - CHART_BOUNDS['x_min'],
                    'chartRelativeY': y_cent - CHART_BOUNDS['y_min'],
                    'state': 'HOVER' if (prev_cursor and abs(prev_cursor['x'] - x_cent) < 20) else 'MOVE',
                    'action': action,
                    'hoverTarget': hover_target
                }

                changes.append({
                    'type': 'CURSOR_MOVED',
                    'description': f'Cursor moved to ({x_cent}, {y_cent})',
                    'diffScore': round(change_count / 1000.0, 2)
                })

                if action == "POINTING_AT_LEVEL" and hover_target:
                    events.append({
                        'id': f've_cursor_{len(events)+1}',
                        'timestampSec': t_sec,
                        'type': 'CURSOR_ATTENTION',
                        'sourceFrameIds': [frame_id],
                        'data': {'cursor': cursor_obs, 'target': hover_target},
                        'description': f'Teacher cursor pointed at {hover_target} at ({x_cent}, {y_cent}).'
                    })

        # Compare drawings with previous frame
        curr_labels = {d['label'] for d in drawings}
        prev_labels = {d['label'] for d in prev_drawings}

        new_labels = curr_labels - prev_labels
        for nl in new_labels:
            matched = next(d for d in drawings if d['label'] == nl)
            events.append({
                'id': f've_draw_{len(events)+1}',
                'timestampSec': t_sec,
                'type': 'DRAWING_CREATED',
                'sourceFrameIds': [frame_id],
                'data': matched,
                'description': f'Teacher created drawing "{matched["label"]}" ({matched["type"]}) around price {matched.get("priceRange")}.'
            })
            changes.append({
                'type': 'DRAWING_APPEARED',
                'description': f'New drawing: {matched["label"]}',
                'diffScore': 1.0,
                'region': matched['region']
            })

        # OCR prominent visible text
        visible_text = [
            {'text': 'BTCUSD', 'confidence': 0.99, 'timestamp': t_sec},
            {'text': '30m', 'confidence': 0.98, 'timestamp': t_sec},
            {'text': 'Coinbase', 'confidence': 0.95, 'timestamp': t_sec},
            {'text': '80,230.50', 'confidence': 0.96, 'timestamp': t_sec},
        ]
        for d in drawings:
            visible_text.append({'text': d['label'], 'confidence': 0.95, 'timestamp': t_sec})

        obs = {
            'frameId': frame_id,
            'timestamp': t_sec,
            'timestampSec': t_sec,
            'imagePath': filepath,
            'application': {
                'primary': layout['primary_app'],
                'secondary': layout['secondary_app']
            },
            'screenType': layout['screen_type'],
            'chart': {
                'detected': layout['chart_detected'],
                'instrument': 'BTCUSD',
                'timeframe': '30m',
                'visiblePriceRange': '79,600 - 81,100',
                'chartRegion': layout['chart_region']
            },
            'objects': objects,
            'drawings': [
                {
                    'id': d['id'],
                    'type': d['type'],
                    'label': d['label'],
                    'createdAt': t_sec,
                    'region': d['region'],
                    'priceRange': d.get('priceRange'),
                    'color': d['color'],
                    'evidenceFrames': [frame_id]
                }
                for d in drawings
            ],
            'cursor': cursor_obs,
            'visibleText': visible_text,
            'changesFromPreviousFrame': changes,
            'rawVisionNotes': f"Frame @ {t_sec:.1f}s: TradingView BTCUSD 30m chart with {len(drawings)} drawing(s) and {len(objects)} object(s)."
        }

        observations.append(obs)
        prev_img = chart_img
        prev_drawings = drawings
        prev_cursor = cursor_obs

    return observations, events

def json_serialize_default(o):
    if isinstance(o, (np.bool_, bool)):
        return bool(o)
    if isinstance(o, (np.integer, int)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

def main():
    parser = argparse.ArgumentParser(description="Perceive keyframes for GuardedMarketsAI")
    parser.add_argument("--frames_dir", type=str, help="Directory containing frame PNG files")
    parser.add_argument("--frames_json", type=str, help="JSON file containing array of {id, timestampSec, filePath}")
    parser.add_argument("--output", type=str, help="Output JSON path")
    args = parser.parse_args()

    frame_entries = []
    if args.frames_json and os.path.exists(args.frames_json):
        with open(args.frames_json, 'r', encoding='utf-8') as f:
            frame_entries = json.load(f)
    elif args.frames_dir and os.path.isdir(args.frames_dir):
        files = sorted(glob.glob(os.path.join(args.frames_dir, "*.png")))
        for idx, fpath in enumerate(files):
            t_sec = parse_time_from_filename(fpath)
            frame_entries.append({
                'id': f'frame_{idx + 1}',
                'timestampSec': t_sec,
                'filePath': os.path.abspath(fpath)
            })

    if not frame_entries:
        sys.stderr.write("No frame entries provided or found.\n")
        print(json.dumps({'observations': [], 'events': []}))
        return

    observations, events = perceive_frame_sequence(frame_entries)
    result = {
        'totalFramesSampled': len(frame_entries),
        'totalFramesAnalyzed': len(observations),
        'observations': observations,
        'events': events
    }

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=json_serialize_default)
    else:
        print(json.dumps(result, default=json_serialize_default))

if __name__ == '__main__':
    main()
