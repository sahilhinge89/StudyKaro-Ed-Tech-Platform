
pipeline {
    agent any

    // GitHub webhook trigger
    triggers {
        githubPush()
    }

    options {
        disableConcurrentBuilds()
        timestamps()
    }

    environment {
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_ORG = 'hackerboypk'

        FRONTEND_IMAGE = 'docker.io/hackerboypk/studykaro'
        BACKEND_IMAGE  = 'docker.io/hackerboypk/studykaro-backend'

        K8S_NAMESPACE = 'studykaro'
        K8S_MANIFEST_DIR = 'K8s'

        DOCKERHUB_CREDENTIALS = 'dockerHubCredentials'
        GIT_CREDENTIALS = 'git'
        KUBE_CONFIG = 'kubeConfig'
    }

    stages {

        // ==========================================
        // STAGE 1: CHECKOUT
        // ==========================================

        stage('Checkout') {
            steps {
                checkout scm

                script {
                    echo "Commit: ${env.GIT_COMMIT}"
                    echo "Branch: ${env.BRANCH_NAME ?: 'main'}"

                    // Display available Git version tags
                    sh 'git tag --list'
                }
            }
        }

        // ==========================================
        // STAGE 2: BACKEND BUILD & TEST
        // ==========================================

        stage('Backend Build & Test') {
            steps {
                dir('server') {

                    sh 'npm ci --omit=dev --no-audit --no-fund'

                    sh 'node --check index.js'
                    sh 'node --check controllers/Auth.js'
                    sh 'node --check middleware/auth.js'
                    sh 'node --check config/cookie.js'
                    sh 'node --check config/cors.js'
                    sh 'node --check routes/user.js'

                    sh 'node tests/auth.cookie.test.js'
                }
            }
        }

        // ==========================================
        // STAGE 3: FRONTEND BUILD & TEST
        // ==========================================

        stage('Frontend Build & Test') {
            steps {
                sh 'npm ci --no-audit --no-fund'

                sh 'npx eslint src --ext .js,.jsx'

                sh 'python3 .lint_scan.py'

                sh 'CI=true npm run build'
            }
        }

        // ==========================================
        // STAGE 4: GENERATE FRONTEND VERSION
        // ==========================================

        stage('Frontend Version') {
            steps {
                script {

                    env.FRONTEND_TAG = sh(
                        script: '''
                            set -eu

                            LATEST_TAG=$(git tag --list 'frontend-v*' |
                                grep -E '^frontend-v[0-9]+\\.[0-9]+\\.[0-9]+$' |
                                sort -V |
                                tail -n 1 || true)

                            if [ -z "$LATEST_TAG" ]; then
                                echo "ERROR: Initial frontend tag missing" >&2
                                exit 1
                            fi

                            VERSION=${LATEST_TAG#frontend-v}

                            IFS='.' read -r MAJOR MINOR PATCH <<EOF
$VERSION
EOF

                            NEXT_PATCH=$((10#$PATCH + 1))

                            echo "$MAJOR.$MINOR.$NEXT_PATCH"
                        ''',
                        returnStdout: true
                    ).trim()

                    echo "Frontend Docker Version: ${env.FRONTEND_TAG}"
                }
            }
        }

        // ==========================================
        // STAGE 5: GENERATE BACKEND VERSION
        // ==========================================

        stage('Backend Version') {
            steps {
                script {

                    env.BACKEND_TAG = sh(
                        script: '''
                            set -eu

                            LATEST_TAG=$(git tag --list 'backend-v*' |
                                grep -E '^backend-v[0-9]+\\.[0-9]+\\.[0-9]+$' |
                                sort -V |
                                tail -n 1 || true)

                            if [ -z "$LATEST_TAG" ]; then
                                echo "ERROR: Initial backend tag missing" >&2
                                exit 1
                            fi

                            VERSION=${LATEST_TAG#backend-v}

                            IFS='.' read -r MAJOR MINOR PATCH <<EOF
$VERSION
EOF

                            NEXT_PATCH=$((10#$PATCH + 1))

                            echo "$MAJOR.$MINOR.$NEXT_PATCH"
                        ''',
                        returnStdout: true
                    ).trim()

                    echo "Backend Docker Version: ${env.BACKEND_TAG}"
                }
            }
        }

        // ==========================================
        // STAGE 6: DOCKER BUILD & PUSH
        // ==========================================

        stage('Docker Build & Push') {
            steps {
                script {

                    withCredentials([
                        usernamePassword(
                            credentialsId: "${DOCKERHUB_CREDENTIALS}",
                            usernameVariable: 'REGISTRY_USER',
                            passwordVariable: 'REGISTRY_PASS'
                        )
                    ]) {

                        sh '''
                            set -eu

                            echo "$REGISTRY_PASS" |
                                docker login \
                                -u "$REGISTRY_USER" \
                                --password-stdin

                            # Build Frontend
                            echo "Building Frontend Image: $FRONTEND_TAG"

                            docker build \
                                -f Dockerfiles/Dockerfile.frontend \
                                -t "$FRONTEND_IMAGE:$FRONTEND_TAG" \
                                -t "$FRONTEND_IMAGE:latest" .

                            # Push Frontend
                            docker push "$FRONTEND_IMAGE:$FRONTEND_TAG"
                            docker push "$FRONTEND_IMAGE:latest"

                            # Build Backend
                            echo "Building Backend Image: $BACKEND_TAG"

                            docker build \
                                -f Dockerfiles/Dockerfile.backend \
                                -t "$BACKEND_IMAGE:$BACKEND_TAG" \
                                -t "$BACKEND_IMAGE:latest" .

                            # Push Backend
                            docker push "$BACKEND_IMAGE:$BACKEND_TAG"
                            docker push "$BACKEND_IMAGE:latest"

                            echo "Both Docker images pushed successfully."
                        '''
                    }
                }
            }
        }

        // ==========================================
        // STAGE 7: CREATE & PUSH GIT VERSION TAGS
        // ==========================================

        stage('Create Git Version Tags') {
            steps {

                withCredentials([
                    gitUsernamePassword(
                        credentialsId: "${GIT_CREDENTIALS}",
                        gitToolName: 'Default'
                    )
                ]) {

                    sh '''
                        set -eu

                        git config user.name "Jenkins"
                        git config user.email "jenkins@example.com"

                        # Check that release tags do not already exist
                        if git rev-parse -q --verify \
                            "refs/tags/frontend-v$FRONTEND_TAG" >/dev/null; then
                            echo "ERROR: Frontend tag already exists"
                            exit 1
                        fi

                        if git rev-parse -q --verify \
                            "refs/tags/backend-v$BACKEND_TAG" >/dev/null; then
                            echo "ERROR: Backend tag already exists"
                            exit 1
                        fi

                        # Create Frontend tag
                        git tag -a "frontend-v$FRONTEND_TAG" \
                            -m "Frontend release $FRONTEND_TAG"

                        # Create Backend tag
                        git tag -a "backend-v$BACKEND_TAG" \
                            -m "Backend release $BACKEND_TAG"

                        # Push release tags
                        git push origin \
                            "frontend-v$FRONTEND_TAG" \
                            "backend-v$BACKEND_TAG"

                        echo "Git release tags pushed successfully."
                    '''
                }
            }
        }

        // ==========================================
        // STAGE 8: KUBERNETES MANIFEST VALIDATION
        // TEMPORARILY DISABLED
        // ==========================================

        /*
        stage('Kubernetes Manifest Validation') {
            steps {
                sh 'python3 .k8s_validate.py'
            }
        }
        */

        // ==========================================
        // STAGE 9: UPDATE KUBERNETES MANIFESTS
        // TEMPORARILY DISABLED
        // ==========================================

        /*
        stage('Update Kubernetes Manifests') {
            steps {
                script {
                    sh """
                        sed -i 's#image: studykaro/backend:.*#image: ${BACKEND_IMAGE}:${BACKEND_TAG}#' ${K8S_MANIFEST_DIR}/Deployment.yaml

                        sed -i 's#image: studykaro/frontend:.*#image: ${FRONTEND_IMAGE}:${FRONTEND_TAG}#' ${K8S_MANIFEST_DIR}/Deployment.yaml
                    """

                    sh "grep -n 'image:' ${K8S_MANIFEST_DIR}/Deployment.yaml"

                    archiveArtifacts artifacts: "${K8S_MANIFEST_DIR}/*.yaml",
                        fingerprint: true
                }
            }
        }
        */

        // ==========================================
        // STAGE 10: APPLY TO KUBERNETES
        // TEMPORARILY DISABLED
        // ==========================================

        /*
        stage('Apply to Kubernetes') {
            when {
                expression {
                    env.DEPLOY_TO_CLUSTER == 'true'
                }
            }

            steps {
                script {
                    withCredentials([
                        file(
                            credentialsId: "${KUBE_CONFIG}",
                            variable: 'KUBECONFIG'
                        )
                    ]) {

                        sh "kubectl apply -f ${K8S_MANIFEST_DIR}/Deployment.yaml"

                        sh "kubectl apply -f ${K8S_MANIFEST_DIR}/Service.yaml"

                        sh "kubectl rollout status deployment/studykaro-backend -n ${K8S_NAMESPACE} --timeout=300s"

                        sh "kubectl rollout status deployment/studykaro-frontend -n ${K8S_NAMESPACE} --timeout=300s"
                    }
                }
            }
        }
        */
    }

    // ==========================================
    // POST BUILD ACTIONS
    // ==========================================

    post {

        always {
            sh '''
                docker rmi \
                    "$BACKEND_IMAGE:${BACKEND_TAG:-unused}" \
                    "$BACKEND_IMAGE:latest" \
                    "$FRONTEND_IMAGE:${FRONTEND_TAG:-unused}" \
                    "$FRONTEND_IMAGE:latest" \
                    2>/dev/null || true

                docker logout || true
            '''
        }

        success {
            echo "=========================================="
            echo "STUDYKARO PIPELINE SUCCESSFUL"
            echo "Frontend: ${env.FRONTEND_IMAGE}:${env.FRONTEND_TAG}"
            echo "Backend:  ${env.BACKEND_IMAGE}:${env.BACKEND_TAG}"
            echo "=========================================="
        }

        failure {
            echo "StudyKaro build ${env.BUILD_NUMBER} failed."
            echo "Check Jenkins console output."
        }
    }
}

