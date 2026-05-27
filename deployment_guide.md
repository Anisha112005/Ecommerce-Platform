# 🚀 ARViz Cloud Deployment & Production Guide

This guide details the step-by-step process to deploy the ARViz AR E-Commerce Platform to popular cloud hosting services.

Since the Flask backend in `backend/app.py` is configured to serve all frontend static assets (HTML, CSS, JS, and 3D models) automatically, you only need to deploy **one single container/service** for the entire platform to be fully operational!

---

## 1. Setting up MongoDB Atlas (Cloud Database)

Before deploying the container, you need a cloud-hosted MongoDB instance.

1. **Sign Up**: Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Create Cluster**: Deploy a free shared cluster (M0 sandbox) in your preferred region.
3. **Database User**: Create a database user with read/write permissions. Keep the password secure.
4. **Network Access (IP Whitelist)**:
   * Go to **Network Access** > **Add IP Address**.
   * Choose **Allow Access from Anywhere** (`0.0.0.0/0`) since cloud containers change IP addresses dynamically.
5. **Get Connection String**:
   * Click **Connect** on your cluster.
   * Select **Drivers** (Python).
   * Copy the connection string (looks like `mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority`).
   * Replace `<username>` and `<password>` with the credentials of the user you created in Step 3.

---

## 2. Deploying to Render (Recommended & Easiest)

Render is highly developer-friendly and fully supports direct Docker deployments.

1. **Sign Up**: Connect your GitHub or GitLab account to [Render](https://render.com).
2. **Create Web Service**:
   * Click **New +** > **Web Service**.
   * Connect your GitHub repository containing the ARViz project.
3. **Configure Service**:
   * **Name**: `arviz-platform`
   * **Environment**: `Docker` (Render automatically detects the root `Dockerfile` and builds it).
   * **Region**: Choose the region closest to your target audience.
   * **Instance Type**: `Free` (or any paid tier of your choice).
4. **Define Environment Variables**:
   * Scroll down and click **Advanced** > **Add Environment Variable**.
   * Add the following keys:
     * `MONGO_URI` = `your_mongodb_atlas_connection_string`
     * `MONGO_DB` = `arviz`
     * `SECRET_KEY` = `some_complex_random_string`
5. **Deploy**: Click **Create Web Service**. Render will automatically pull your repository, build the Docker container, run the health check, and assign a public `https://...onrender.com` URL!

---

## 3. Deploying to Google Cloud Run (Recommended for Scalability)

Google Cloud Run is a serverless platform that scales containers automatically and offers a generous free tier.

1. **Install SDK**: Ensure you have the `gcloud` CLI installed locally.
2. **Authenticate & Select Project**:
   ```bash
   gcloud auth login
   gcloud config set project <YOUR_PROJECT_ID>
   ```
3. **Build & Deploy in One Command**:
   Run this command in the root folder of the project (where the `Dockerfile` is located):
   ```bash
   gcloud run deploy arviz-platform \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars MONGO_URI="your_mongodb_atlas_connection_string",MONGO_DB="arviz",SECRET_KEY="some_complex_random_string"
   ```
4. **Access Link**: Cloud Run will build your container in the cloud using Google Cloud Build and output a secure HTTPS link to access your live store.

---

## 4. Deploying to Heroku

Heroku supports Docker container deployments using their Container Registry.

1. **Configure heroku.yml**: (Optional but recommended for Git-based builds) or use the Heroku CLI.
2. **Login to Container Registry**:
   ```bash
   heroku login
   heroku container:login
   ```
3. **Create Heroku App**:
   ```bash
   heroku create arviz-platform
   ```
4. **Push Container**:
   ```bash
   heroku container:push web --app arviz-platform
   ```
5. **Release Container**:
   ```bash
   heroku container:release web --app arviz-platform
   ```
6. **Set Config Vars**:
   ```bash
   heroku config:set MONGO_URI="your_mongodb_atlas_connection_string" --app arviz-platform
   # Heroku will automatically inject the dynamic $PORT environment variable
   ```

---

## 5. Deploying to AWS App Runner

AWS App Runner is a fully managed service that makes it easy to deploy containerized web applications.

1. **Push to Amazon ECR**:
   * Create a private repository in Amazon Elastic Container Registry (ECR).
   * Authenticate and push your Docker image:
     ```bash
     docker build -t arviz-platform .
     docker tag arviz-platform:latest <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/arviz-platform:latest
     aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
     docker push <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/arviz-platform:latest
     ```
2. **Create Service in App Runner**:
   * Go to **AWS App Runner Console** > **Create Service**.
   * Choose **Container registry** > **Amazon ECR**.
   * Select the repository and tag you just pushed.
   * Set deployment trigger to **Automatic** (redeploy on push) or **Manual**.
   * Define environment variables (`MONGO_URI`, `MONGO_DB`, `SECRET_KEY`) under **Configuration**.
   * Click **Create & Deploy**!
