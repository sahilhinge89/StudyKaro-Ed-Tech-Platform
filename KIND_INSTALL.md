kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: studykaro

nodes:
  - role: control-plane

  - role: worker
    extraPortMappings:
      - containerPort: 32001
        hostPort: 32001
        protocol: TCP
      - containerPort: 32002
        hostPort: 32002
        protocol: TCP

  - role: worker


## Optional — Install MetalLB for LoadBalancer Support

KIND does not provision `type: LoadBalancer` services by default. If you want to use `frontend-svc-loadbalancer.yaml`:

```bash
# Install MetalLB
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.5/config/manifests/metallb-native.yaml

# Create IPAddressPool (adjust CIDR to your KIND node network)
kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: kind-pool
  namespace: metallb-system
spec:
  addresses:
    - 172.18.255.1-172.18.255.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: kind-ad
  namespace: metallb-system
EOF

# Then apply the LoadBalancer variant
kubectl apply -f K8s/frontend-svc-loadbalancer.yaml -n studykaro

> Finding the right IP range for MetalLB in KIND can be tricky. NodePort is simpler and recommended for local development.
