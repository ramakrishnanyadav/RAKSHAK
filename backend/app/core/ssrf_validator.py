"""
Server-Side Request Forgery (SSRF) Defense Module.
Validates outbound URLs before ingestion:
- Enforces strict https / http protocol whitelist
- Disallows loopback (127.0.0.0/8, ::1)
- Disallows RFC 1918 private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Disallows link-local & cloud metadata IPs (169.254.169.254, fe80::/10)
- Disallows dangerous schemes (file://, gopher://, ftp://, dict://)
"""

import ipaddress
import socket
from urllib.parse import urlparse


DANGEROUS_SCHEMES = {"file", "gopher", "ftp", "tftp", "dict", "ldap", "data"}


def validate_outbound_url(url: str, allow_private: bool = False) -> bool:
    """
    Validates that a URL is safe for server-side fetching and does NOT target
    internal microservices, loopback, or cloud instance metadata.
    """
    if not url:
        raise ValueError("URL cannot be empty.")

    parsed = urlparse(url)
    scheme = parsed.scheme.lower()

    if scheme in DANGEROUS_SCHEMES or scheme not in {"http", "https"}:
        raise ValueError(f"Insecure scheme '{scheme}': Only HTTP and HTTPS are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Malformed URL: Missing valid hostname.")

    # Reject localhost directly
    if hostname.lower() in {"localhost", "localhost.localdomain"}:
        raise ValueError(f"SSRF violation: Hostname '{hostname}' targets internal loopback.")

    # Resolve IP address to detect DNS rebinding and internal IP targeting
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        ips = [ai[4][0] for ai in addr_info]
    except socket.gaierror:
        # If hostname cannot be resolved, check if hostname is already a raw IP
        ips = [hostname]

    for ip_str in ips:
        try:
            ip = ipaddress.ip_address(ip_str)

            if not allow_private:
                if ip.is_loopback:
                    raise ValueError(f"SSRF violation: IP {ip_str} is a loopback address.")
                if ip.is_private:
                    raise ValueError(f"SSRF violation: IP {ip_str} is in an internal private network.")
                if ip.is_link_local:
                    raise ValueError(f"SSRF violation: IP {ip_str} is in a link-local address range.")
                if ip.is_reserved or ip.is_multicast:
                    raise ValueError(f"SSRF violation: IP {ip_str} is in a reserved or multicast address range.")
                # Explicit check for AWS / GCP / Azure link-local metadata address 169.254.169.254
                if str(ip) == "169.254.169.254":
                    raise ValueError("SSRF violation: Access to cloud instance metadata service is prohibited.")

        except ValueError as err:
            if "SSRF violation" in str(err):
                raise
            # If not a valid IP string, continue
            pass

    return True
