from pathlib import Path
import sys

import yaml


manifest_files = sorted(Path("K8s").glob("*.yaml"))
resources = []
ok = True

for manifest_file in manifest_files:
    try:
        resources.extend(
            document
            for document in yaml.safe_load_all(manifest_file.read_text())
            if document
        )
    except (OSError, yaml.YAMLError) as error:
        print(f"FAIL parse {manifest_file}: {error}")
        ok = False

workloads = [
    resource
    for resource in resources
    if resource.get("kind") in {"Deployment", "StatefulSet", "DaemonSet"}
]
services = [resource for resource in resources if resource.get("kind") == "Service"]

for workload in workloads:
    metadata = workload["metadata"]
    pod_spec = workload["spec"]["template"]["spec"]
    container = pod_spec["containers"][0]
    security_context = container.get("securityContext", {})
    print(
        f"{workload['kind']} / {metadata['name']}: "
        f"container={container['name']} "
        f"port={container.get('ports', [{}])[0].get('containerPort')} "
        f"runAsUser={security_context.get('runAsUser')} "
        f"readOnlyRootFs={security_context.get('readOnlyRootFilesystem')}"
    )

    declared_volumes = {volume["name"] for volume in pod_spec.get("volumes", [])}
    for mount in container.get("volumeMounts", []):
        if mount["name"] not in declared_volumes:
            print(f"ERROR: {metadata['name']} mount references undeclared volume {mount['name']}")
            ok = False

for service in services:
    service_name = service["metadata"]["name"]
    selector = service["spec"].get("selector", {})
    matching_workloads = []
    for workload in workloads:
        labels = workload["spec"]["template"]["metadata"].get("labels", {})
        if selector and all(labels.get(key) == value for key, value in selector.items()):
            matching_workloads.append(workload["metadata"]["name"])
    print(f"Service {service_name} selector matches workloads: {matching_workloads}")
    if not matching_workloads:
        print(f"ERROR: Service {service_name} has no matching workload")
        ok = False

nginx_config = Path("Dockerfiles/nginx.conf").read_text()
service_by_name = {service["metadata"]["name"]: service for service in services}
for line in nginx_config.splitlines():
    if "proxy_pass" not in line:
        continue
    target = line.split("proxy_pass", 1)[1].strip().rstrip(";")
    # Variable-based proxy_pass (e.g. $backend) resolves DNS at runtime via
    # the resolver directive — skip static service validation for those.
    if target.startswith("$"):
        print(f"nginx proxy_pass -> {target} | variable-based (runtime DNS resolution)")
        continue
    address = target.removeprefix("http://").removeprefix("https://")
    host, _, port = address.partition(":")
    service = service_by_name.get(host)
    print(f"nginx proxy_pass -> {target} | service exists: {service is not None}")
    if service is None:
        print(f"ERROR: NGINX upstream {host} has no matching Service")
        ok = False
    elif port not in {str(item["port"]) for item in service["spec"]["ports"]}:
        print(f"ERROR: NGINX upstream port {port} is not exposed by Service {host}")
        ok = False

print("RESULT:", "OK" if ok else "FAILED")
sys.exit(0 if ok else 1)
