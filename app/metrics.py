import time
import platform
import psutil
import socket

def _loadavg():
    try:
        a, b, c = psutil.getloadavg()  # Unix
        return {"1m": a, "5m": b, "15m": c}
    except (AttributeError, OSError):
        return None

def current_metrics(per_cpu: bool = False):
    vm = psutil.virtual_memory()
    sw = psutil.swap_memory()

    cpu_total = psutil.cpu_percent(interval=None)
    cpu_detail = psutil.cpu_percent(interval=None, percpu=True) if per_cpu else None

    return {
        "timestamp": int(time.time()),
        "uptime_seconds": get_uptime(),
        "cpu": {
            "percent": cpu_total,
            "per_cpu": cpu_detail,
            "counts": {
                "logical": psutil.cpu_count(logical=True),
                "physical": psutil.cpu_count(logical=False)
            },
            "load_avg": _loadavg()
        },
        "memory": {
            "total": vm.total,
            "available": vm.available,
            "used": vm.used,
            "percent": vm.percent
        },
        "swap": {
            "total": sw.total,
            "used": sw.used,
            "percent": sw.percent
        },
        "host": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine()
        }
    }

def get_hostname() -> str:
    """Get the hostname of the server."""
    return platform.node()

def get_uptime() -> int:
    """Get the uptime of the server."""
    return int(time.time() - psutil.boot_time())

def get_address(v6: bool = False) -> str:
    """Get the IP address of the server."""
    addrs = psutil.net_if_addrs()
    for _, addr_list in addrs.items():
        for addr in addr_list:
            if (v6 and addr.family == socket.AF_INET6) or (not v6 and addr.family == socket.AF_INET):
                if not addr.address.startswith("127.") and not addr.address == "::1":
                    return addr.address
    return "Unavailable"
