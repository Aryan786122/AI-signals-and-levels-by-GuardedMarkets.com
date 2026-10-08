#!/usr/bin/env python3
"""
Local Whisper Transcription Engine using faster-whisper (CTranslate2).
Supports NVIDIA CUDA acceleration with CPU int8 quantization fallback,
model caching, live progress streaming, VAD filtering, and exact word/segment timestamps.
"""

import os
import sys
import json
import math
import argparse
from pathlib import Path

# Fix Windows NVIDIA DLL loading for CUDA 12 if installed via pip
if sys.platform == "win32":
    for p in sys.path:
        if "site-packages" in p:
            nv_base = os.path.join(p, "nvidia")
            if os.path.isdir(nv_base):
                for sub in os.listdir(nv_base):
                    bin_dir = os.path.join(nv_base, sub, "bin")
                    if os.path.isdir(bin_dir):
                        os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")
                        if hasattr(os, "add_dll_directory"):
                            try:
                                os.add_dll_directory(bin_dir)
                            except Exception:
                                pass


def emit_json(event_type: str, **kwargs):
    payload = {"type": event_type, **kwargs}
    print(json.dumps(payload), flush=True)


def check_status(model_name: str, cache_dir: str):
    """Probes whether faster-whisper is installed, checks GPU hardware, and model cache status."""
    status = {
        "installed": False,
        "cuda_available": False,
        "device": "cpu",
        "compute_type": "int8",
        "gpu_name": None,
        "model_cached": False,
        "model": model_name,
        "cache_dir": cache_dir,
        "error": None,
    }

    try:
        import ctranslate2
        from faster_whisper import WhisperModel
        status["installed"] = True

        cuda_count = ctranslate2.get_cuda_device_count()
        if cuda_count > 0:
            status["cuda_available"] = True
            status["device"] = "cuda"
            status["compute_type"] = "float16"
            try:
                # Try to get GPU name via torch if available
                import torch
                if torch.cuda.is_available():
                    status["gpu_name"] = torch.cuda.get_device_name(0)
            except Exception:
                status["gpu_name"] = "NVIDIA CUDA Device"
        else:
            status["cuda_available"] = False
            status["device"] = "cpu"
            status["compute_type"] = "int8"

        # Check if model exists in cache_dir
        cache_path = Path(cache_dir)
        if cache_path.exists():
            # Check for model files (bin or safetensors)
            model_files = list(cache_path.glob(f"*{model_name}*")) + list(cache_path.glob("**/model.bin"))
            status["model_cached"] = len(model_files) > 0

    except ImportError as e:
        status["installed"] = False
        status["error"] = f"faster-whisper is not installed: {str(e)}"
    except Exception as e:
        status["error"] = str(e)

    return status


def transcribe_audio(
    audio_path: str,
    model_name: str = "small",
    device: str = "auto",
    compute_type: str = "auto",
    cache_dir: str = "./storage/models/whisper",
    language: str = None,
):
    if not os.path.exists(audio_path):
        emit_json("ERROR", error=f"Audio file not found: {audio_path}")
        sys.exit(1)

    # 1. Hardware Detection
    emit_json("PROGRESS", stage="DETECTING_HARDWARE")
    try:
        import ctranslate2
        from faster_whisper import WhisperModel
    except ImportError as e:
        emit_json(
            "ERROR",
            error=f"faster-whisper is not installed. Please run: pip install faster-whisper ({str(e)})",
            stage="MODEL_NOT_INSTALLED",
        )
        sys.exit(1)

    cuda_count = 0
    try:
        cuda_count = ctranslate2.get_cuda_device_count()
    except Exception:
        cuda_count = 0

    if device == "auto":
        if cuda_count > 0:
            chosen_device = "cuda"
            chosen_compute = "float16" if compute_type == "auto" else compute_type
        else:
            chosen_device = "cpu"
            chosen_compute = "int8" if compute_type == "auto" else compute_type
    else:
        chosen_device = device
        chosen_compute = compute_type if compute_type != "auto" else ("float16" if chosen_device == "cuda" else "int8")

    gpu_name = None
    if chosen_device == "cuda":
        try:
            import torch
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
        except Exception:
            gpu_name = "NVIDIA CUDA Device"

    emit_json(
        "PROGRESS",
        stage="HARDWARE_DETECTED",
        device=chosen_device,
        computeType=chosen_compute,
        gpuName=gpu_name,
        cudaAvailable=cuda_count > 0,
    )

    # 2. Model Loading & Caching
    os.makedirs(cache_dir, exist_ok=True)
    emit_json(
        "PROGRESS",
        stage="DOWNLOADING_MODEL",
        model=model_name,
        cacheDir=os.path.abspath(cache_dir),
    )

    try:
        # If CUDA initialization fails (e.g. missing cuDNN dlls), cleanly fall back to CPU int8
        model = None
        try:
            model = WhisperModel(
                model_name,
                device=chosen_device,
                compute_type=chosen_compute,
                download_root=cache_dir,
            )
        except Exception as init_err:
            if chosen_device == "cuda":
                emit_json(
                    "PROGRESS",
                    stage="FALLBACK_TO_CPU",
                    warning=f"CUDA initialization failed ({str(init_err)}). Falling back to CPU int8.",
                )
                chosen_device = "cpu"
                chosen_compute = "int8"
                model = WhisperModel(
                    model_name,
                    device=chosen_device,
                    compute_type=chosen_compute,
                    download_root=cache_dir,
                )
            else:
                raise init_err

        emit_json(
            "PROGRESS",
            stage="MODEL_READY",
            model=model_name,
            device=chosen_device,
            computeType=chosen_compute,
        )
    except Exception as e:
        emit_json("ERROR", stage="FAILED", error=f"Failed to load/download Whisper model: {str(e)}")
        sys.exit(1)

    # 3. Transcription with VAD filtering & progress
    emit_json("PROGRESS", stage="TRANSCRIBING", progress=0)

    try:
        segments_generator = None
        info = None
        first_seg = None

        try:
            segments_generator, info = model.transcribe(
                audio_path,
                beam_size=5,
                language=language,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
            )
            # Peek first segment to verify device execution
            first_seg = next(segments_generator, None)
        except Exception as device_err:
            if chosen_device == "cuda":
                emit_json(
                    "PROGRESS",
                    stage="FALLBACK_TO_CPU",
                    warning=f"CUDA execution not available ({str(device_err)}). Falling back to CPU int8.",
                )
                chosen_device = "cpu"
                chosen_compute = "int8"
                model = WhisperModel(
                    model_name,
                    device="cpu",
                    compute_type="int8",
                    download_root=cache_dir,
                )
                segments_generator, info = model.transcribe(
                    audio_path,
                    beam_size=5,
                    language=language,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500),
                )
                first_seg = next(segments_generator, None)
            else:
                raise device_err

        detected_language = info.language
        lang_prob = round(info.language_probability, 4)
        total_duration = round(info.duration, 2)

        emit_json(
            "PROGRESS",
            stage="AUDIO_INFO",
            detectedLanguage=detected_language,
            languageProbability=lang_prob,
            audioDurationSec=total_duration,
        )

        segments = []
        full_text_parts = []

        # Process first peeked segment if available
        if first_seg is not None:
            seg_start = round(float(first_seg.start), 2)
            seg_end = round(float(first_seg.end), 2)
            seg_text = first_seg.text.strip()
            conf = round(min(1.0, max(0.4, math.exp(first_seg.avg_logprob))), 3)
            s_dict = {
                "startTimeSec": seg_start,
                "endTimeSec": seg_end,
                "text": seg_text,
                "confidence": conf,
            }
            segments.append(s_dict)
            full_text_parts.append(seg_text)
            emit_json("SEGMENT", segment=s_dict)

        for seg in segments_generator:
            start_sec = round(float(seg.start), 2)
            end_sec = round(float(seg.end), 2)
            text = seg.text.strip()
            
            # Confidence estimation from avg_logprob
            confidence = round(min(1.0, max(0.4, math.exp(seg.avg_logprob))), 3)

            segment_dict = {
                "startTimeSec": start_sec,
                "endTimeSec": end_sec,
                "text": text,
                "confidence": confidence,
            }
            segments.append(segment_dict)
            full_text_parts.append(text)

            # Emit each segment in real time
            emit_json("SEGMENT", segment=segment_dict)

            # Compute transcription progress
            if total_duration > 0:
                prog = min(99.0, round((end_sec / total_duration) * 100, 1))
                emit_json(
                    "PROGRESS",
                    stage="TRANSCRIBING",
                    progress=prog,
                    currentTime=end_sec,
                    totalDuration=total_duration,
                )

        full_text = " ".join(full_text_parts)
        last_end_time = segments[-1]["endTimeSec"] if segments else 0.0
        coverage = min(100.0, round((last_end_time / total_duration) * 100, 1)) if total_duration > 0 else 100.0

        result = {
            "success": True,
            "stage": "COMPLETE",
            "fullText": full_text,
            "segments": segments,
            "segmentCount": len(segments),
            "language": detected_language,
            "audioDurationSec": total_duration,
            "lastTimestampSec": last_end_time,
            "coveragePercentage": coverage,
            "device": chosen_device,
            "computeType": chosen_compute,
            "gpuName": gpu_name,
            "model": model_name,
        }

        emit_json("RESULT", **result)
        return result

    except Exception as e:
        emit_json("ERROR", stage="FAILED", error=f"Transcription error: {str(e)}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Local faster-whisper transcription engine")
    parser.add_argument("--audio", type=str, help="Path to input audio file")
    parser.add_argument("--model", type=str, default=os.getenv("WHISPER_MODEL", "small"), help="Whisper model name (tiny, base, small, medium, large-v3)")
    parser.add_argument("--device", type=str, default=os.getenv("WHISPER_DEVICE", "auto"), help="Device: auto, cuda, cpu")
    parser.add_argument("--compute_type", type=str, default=os.getenv("WHISPER_COMPUTE_TYPE", "auto"), help="Compute type: auto, float16, int8_float16, int8")
    parser.add_argument("--cache_dir", type=str, default=os.getenv("WHISPER_CACHE_DIR", "./storage/models/whisper"), help="Model download/cache directory")
    parser.add_argument("--language", type=str, default=None, help="Force language (e.g. en)")
    parser.add_argument("--check_status", action="store_true", help="Check installation & hardware status")
    parser.add_argument("--output", type=str, default=None, help="Save final result JSON to this file")

    args = parser.parse_args()

    if args.check_status:
        status = check_status(args.model, args.cache_dir)
        print(json.dumps(status))
        sys.exit(0 if status["installed"] else 2)

    if not args.audio:
        parser.error("--audio argument is required when not using --check_status")

    result = transcribe_audio(
        audio_path=args.audio,
        model_name=args.model,
        device=args.device,
        compute_type=args.compute_type,
        cache_dir=args.cache_dir,
        language=args.language,
    )

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
