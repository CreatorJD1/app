"""Optional Hugging Face Dataset adapter for persistent VRM storage.

Enable by setting HF_TOKEN and HF_DATASET_REPO (e.g. "your-user/vroid-companion-storage").
When enabled, uploaded VRMs are ALSO uploaded to the dataset (in addition to disk) so
the container can restart / redeploy without losing user files.

Usage in code:
  from hf_dataset_storage import hf_upload_if_enabled
  hf_upload_if_enabled(local_path, remote_path)
"""
import os
from pathlib import Path


def _enabled() -> bool:
    return bool(os.getenv("HF_TOKEN") and os.getenv("HF_DATASET_REPO"))


def hf_upload_if_enabled(local_path: str, remote_path: str) -> bool:
    if not _enabled():
        return False
    try:
        from huggingface_hub import HfApi  # imported lazily; not required by default
    except Exception:
        return False
    try:
        api = HfApi(token=os.getenv("HF_TOKEN"))
        api.upload_file(
            path_or_fileobj=local_path,
            path_in_repo=remote_path,
            repo_id=os.getenv("HF_DATASET_REPO"),
            repo_type="dataset",
            commit_message="vcs upload",
        )
        return True
    except Exception:
        return False


def hf_download_if_enabled(remote_path: str, local_dest: str) -> bool:
    if not _enabled():
        return False
    try:
        from huggingface_hub import hf_hub_download
    except Exception:
        return False
    try:
        fp = hf_hub_download(
            repo_id=os.getenv("HF_DATASET_REPO"),
            repo_type="dataset",
            filename=remote_path,
            token=os.getenv("HF_TOKEN"),
        )
        Path(local_dest).write_bytes(Path(fp).read_bytes())
        return True
    except Exception:
        return False
