# MetalLB Installation for StudyKaro on KIND

## Prerequisites

MetalLB requires a Layer 2 network setup. In KIND, this works because all nodes are on the same network.

## Step 1: Install MetalLB Controller

kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.5/config/manifests/metallb-native.yaml

## Step 2: Create IPAddressPool

kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: studykaro-pool
  namespace: metallb-system
spec:
  addresses:
    - 172.18.255.1-172.18.255.250
