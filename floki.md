# StudyKaro - Local EKS Deployment with Floci

This guide covers setting up and deploying StudyKaro on a local Kubernetes cluster using Floci on **Arch Linux and Windows**.

## Architecture

- **Floci:** Emulates AWS services, including EKS.
- **Docker:** Runs Floci and the Kubernetes node.
- **AWS CLI:** Manages emulated AWS resources.
- **kubectl:** Deploys and manages Kubernetes resources.
- **MongoDB:** Application database with persistent storage.

---

# Prerequisites

## Linux (Arch Linux)

Install the required packages:

```bash
sudo pacman -S docker aws-cli kubectl jq
```

Enable and start Docker:

```bash
sudo systemctl enable --now docker
```

The commands below use `sudo docker` because Docker may require elevated permissions on Arch Linux.

## Windows

Install:

- Docker Desktop with Linux containers enabled.
- AWS CLI v2.
- kubectl.
- PowerShell 7 (recommended).

Verify the installations:

```powershell
docker --version
aws --version
kubectl version --client
```

Make sure Docker Desktop is running before continuing.

---

# Part 1: Persistent environment variables

These settings configure the AWS CLI to communicate with the local Floci instance.

The initial `test` credentials are used to bootstrap the local IAM user. Later, they will be replaced with the generated `eks-admin` credentials.

These are local emulator credentials, not real AWS credentials.

## Linux (Bash)

Create a configuration directory:

```bash
mkdir -p ~/.config/studykaro
```

Create the environment file:

```bash
cat > ~/.config/studykaro/floci.env <<'EOF'
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_DEFAULT_REGION="us-east-1"
export AWS_ENDPOINT_URL="http://localhost:4566"
export AWS_EC2_METADATA_DISABLED="true"
EOF
```

Restrict file permissions:

```bash
chmod 600 ~/.config/studykaro/floci.env
```

Automatically load the file in new Bash terminals:

```bash
grep -qxF 'source "$HOME/.config/studykaro/floci.env"' ~/.bashrc ||
  echo 'source "$HOME/.config/studykaro/floci.env"' >> ~/.bashrc
```

Load it in the current terminal:

```bash
source ~/.config/studykaro/floci.env
```

For Zsh, add the same source line to `~/.zshrc` instead of `~/.bashrc`.

## Windows (PowerShell)

Create the configuration directory:

```powershell
New-Item -ItemType Directory -Force "$HOME\.config\studykaro"
```

Create the environment file:

```powershell
@'
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = "us-east-1"
$env:AWS_ENDPOINT_URL = "http://localhost:4566"
$env:AWS_EC2_METADATA_DISABLED = "true"
'@ | Set-Content -Encoding utf8 "$HOME\.config\studykaro\floci.ps1"
```

Automatically load it in new PowerShell terminals:

```powershell
if (!(Test-Path $PROFILE)) {
    New-Item -ItemType File -Force $PROFILE
}

$line = '. "$HOME\.config\studykaro\floci.ps1"'

if (!(Get-Content $PROFILE | Where-Object { $_ -eq $line })) {
    Add-Content $PROFILE $line
}
```

Load it in the current terminal:

```powershell
. "$HOME\.config\studykaro\floci.ps1"
```

**Important:** Part 4 replaces the initial `test` credentials with the generated `eks-admin` credentials and saves them to this file automatically.

Keep this file private. It contains credentials.

---

# Part 2: Start Floci

Floci runs locally on port `4566`.

## Linux

Create persistent Docker storage:

```bash
sudo docker volume create floci-data
```

Start Floci:

```bash
sudo docker run -d \
  --name flocii \
  --restart unless-stopped \
  -p 127.0.0.1:4566:4566 \
  -v floci-data:/app/data \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e FLOCI_STORAGE_MODE=persistent \
  -e FLOCI_STORAGE_PERSISTENT_PATH=/app/data \
  -e FLOCI_DEFAULT_REGION=us-east-1 \
  floci/floci:latest
```

## Windows

Create the Docker volume:

```powershell
docker volume create floci-data
```

Start Floci:

```powershell
docker run -d `
  --name flocii `
  --restart unless-stopped `
  -p 127.0.0.1:4566:4566 `
  -v floci-data:/app/data `
  -v /var/run/docker.sock:/var/run/docker.sock `
  -e FLOCI_STORAGE_MODE=persistent `
  -e FLOCI_STORAGE_PERSISTENT_PATH=/app/data `
  -e FLOCI_DEFAULT_REGION=us-east-1 `
  floci/floci:latest
```

Docker Desktop must be running with Linux containers enabled.

## Verify Floci

Linux:

```bash
sudo docker logs --tail 50 flocii
```

Windows:

```powershell
docker logs --tail 50 flocii
```

Check AWS connectivity on either platform:

```bash
aws sts get-caller-identity
aws eks list-clusters
```

On Windows, run the same commands in PowerShell.

---

# Part 3: Create the EKS IAM role

Create an IAM role with the EKS service as its trusted principal.

## Linux

Create the trust policy:

```bash
cat > ~/.config/studykaro/eks-trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
```

Create the role:

```bash
aws iam create-role \
  --role-name eks-role \
  --assume-role-policy-document file://$HOME/.config/studykaro/eks-trust-policy.json
```

## Windows (PowerShell)

Create the trust policy:

```powershell
@'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
'@ | Set-Content -Encoding utf8 "$HOME\.config\studykaro\eks-trust-policy.json"
```

Create the role:

```powershell
$policyPath = "$HOME\.config\studykaro\eks-trust-policy.json"
$policyUri = "file:///" + ($policyPath -replace '\\', '/')

aws iam create-role `
  --role-name eks-role `
  --assume-role-policy-document $policyUri
```

---

# Part 4: Create the EKS admin identity

Create a dedicated IAM user for Kubernetes authentication.

At this stage, the environment file should still contain the initial `test` credentials.

## Create the IAM user

Run on either platform:

```bash
aws iam create-user --user-name eks-admin
```

## Linux (Bash)

Generate an access key:

```bash
KEY_JSON=$(aws iam create-access-key --user-name eks-admin)

export AWS_ACCESS_KEY_ID=$(echo "$KEY_JSON" | jq -r '.AccessKey.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$KEY_JSON" | jq -r '.AccessKey.SecretAccessKey')

unset KEY_JSON
```

Save the generated credentials into the persistent environment file:

```bash
{
  printf 'export AWS_ACCESS_KEY_ID=%q\n' "$AWS_ACCESS_KEY_ID"
  printf 'export AWS_SECRET_ACCESS_KEY=%q\n' "$AWS_SECRET_ACCESS_KEY"
  printf 'export AWS_DEFAULT_REGION=%q\n' "$AWS_DEFAULT_REGION"
  printf 'export AWS_ENDPOINT_URL=%q\n' "$AWS_ENDPOINT_URL"
  printf 'export AWS_EC2_METADATA_DISABLED=%q\n' "$AWS_EC2_METADATA_DISABLED"
} > ~/.config/studykaro/floci.env

chmod 600 ~/.config/studykaro/floci.env
```

## Windows (PowerShell)

Generate an access key:

```powershell
$key = aws iam create-access-key --user-name eks-admin | ConvertFrom-Json

$env:AWS_ACCESS_KEY_ID = $key.AccessKey.AccessKeyId
$env:AWS_SECRET_ACCESS_KEY = $key.AccessKey.SecretAccessKey
```

Save the generated credentials into the persistent environment file:

```powershell
@"
`$env:AWS_ACCESS_KEY_ID = "$($key.AccessKey.AccessKeyId)"
`$env:AWS_SECRET_ACCESS_KEY = "$($key.AccessKey.SecretAccessKey)"
`$env:AWS_DEFAULT_REGION = "us-east-1"
`$env:AWS_ENDPOINT_URL = "http://localhost:4566"
`$env:AWS_EC2_METADATA_DISABLED = "true"
"@ | Set-Content -Encoding utf8 "$HOME\.config\studykaro\floci.ps1"
```

The current terminal already has the generated credentials. New PowerShell terminals will load them from the updated profile file.

## Verify the identity

Run on either platform:

```bash
aws sts get-caller-identity
```

Expected identity:

```text
arn:aws:iam::000000000000:user/eks-admin
```

From this point onward, use the `eks-admin` credentials.

---

# Part 5: Create the EKS cluster

Create the local EKS cluster:

```bash
aws eks create-cluster \
  --name study-k8s \
  --role-arn arn:aws:iam::000000000000:role/eks-role \
  --resources-vpc-config 'subnetIds=[],securityGroupIds=[]'
```

Wait for activation:

```bash
aws eks wait cluster-active --name study-k8s
```

Verify the cluster:

```bash
aws eks describe-cluster \
  --name study-k8s \
  --query 'cluster.[status,endpoint,version]' \
  --output table
```

The AWS CLI commands above also work in PowerShell.

---

# Part 6: Configure kubectl

Configure the Kubernetes context:

```bash
aws eks update-kubeconfig --name study-k8s
```

Check the node:

```bash
kubectl get nodes -o wide
```

Check system pods:

```bash
kubectl get pods -A
```

The Kubernetes node should show `Ready`.

---

# Part 7: Deploy StudyKaro

Run these commands from the StudyKaro project root.

**Apply manifests in dependency order.**

The Namespace is declared in `Deployment.yaml`, so apply it first:

```bash
kubectl apply -f K8s/Deployment.yaml
kubectl apply -f K8s/ConfigMap.yaml
kubectl apply -f K8s/Secret.yaml
kubectl apply -f K8s/MongoDB-PVC.yaml
kubectl apply -f K8s/MongoDB-StatefulSet.yaml
kubectl apply -f K8s/Service.yaml
```

These commands work on both Linux and Windows.

Applying the manifests in this order ensures the namespace exists before the other namespaced resources are created.

---

# Part 8: Verify the deployment

Check the application resources:

```bash
kubectl get all -n studykaro
```

Check persistent volume claims:

```bash
kubectl get pvc -n studykaro
```

Check ingress:

```bash
kubectl get ingress -n studykaro
```

Check events:

```bash
kubectl get events -n studykaro --sort-by='.lastTimestamp'
```

Check backend logs:

```bash
kubectl logs -n studykaro deployment/studykaro-backend
```

Check MongoDB logs:

```bash
kubectl logs -n studykaro mongodb-0
```

A healthy deployment should have its application pods running and MongoDB's PVC bound.

**Storage note:** Floci's EKS cluster may not have a `standard` StorageClass. If the MongoDB PVC remains `Pending`, configure a supported StorageClass or persistent volume before considering the deployment complete.

---

# Part 9: Persistence and restarts

Floci stores persistent state in the Docker volume `floci-data`.

Restart Floci:

Linux:

```bash
sudo docker restart flocii
```

Windows:

```powershell
docker restart flocii
```

Verify the cluster:

```bash
aws eks list-clusters
kubectl get nodes
kubectl get pods -A
```

Docker must start automatically at boot:

- **Linux:** `sudo systemctl enable docker`
- **Windows:** Enable Docker Desktop's startup option in its settings.

Floci uses `--restart unless-stopped`, so its container restarts when Docker starts.

The environment files also load automatically in new Bash or PowerShell terminals.

---

# Part 10: Cleanup

Only execute these commands when intentionally removing the application.

## Remove StudyKaro Kubernetes resources

```bash
kubectl delete -f K8s/Service.yaml
kubectl delete -f K8s/MongoDB-StatefulSet.yaml
kubectl delete -f K8s/MongoDB-PVC.yaml
kubectl delete -f K8s/Secret.yaml
kubectl delete -f K8s/ConfigMap.yaml
kubectl delete -f K8s/Deployment.yaml
```

## Delete the EKS cluster

```bash
aws eks delete-cluster --name study-k8s
```

**Warning:** Removing PVCs, Docker volumes, or the EKS cluster can destroy application data.

Do not delete `floci-data` or the Floci container during normal development.

---

# Important notes

- Use the same AWS region for all commands: `us-east-1`.
- Use `eks-admin` credentials for Kubernetes authentication.
- Keep the environment files private. Never commit them to Git.
- Never commit Kubernetes Secrets to Git.
- Keep Floci's persistent Docker volume.
- Apply Kubernetes manifests in dependency order.
- Confirm PVCs are `Bound` and pods are `Running` before considering deployment successful.
- If you generate another IAM access key, update the persistent environment file with the new credentials.
